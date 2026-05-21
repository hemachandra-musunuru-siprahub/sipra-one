import { Router, Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import dotenv from "dotenv";
import { query } from "../db";
import { requireAuth, AuthRequest, invalidateUserCache } from "../middleware/auth";
import { seedRoleFromEntraClaims } from "../lib/roles";

dotenv.config();

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_change_me";

// ─── JWKS singleton — created once at startup, keys cached for 10 min ─────────
const jwksSingleton = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 10 * 60 * 1000, // 10 minutes
  rateLimit: true,
});

router.get("/debug-config", (req: Request, res: Response) => {
  res.json({
    tenantId: process.env.ENTRA_TENANT_ID,
    clientId: process.env.ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/v2.0`,
    jwksUri: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
    frontendUrl: process.env.FRONTEND_URL
  });
});

router.get("/debug-jwks", async (req: Request, res: Response) => {
  const jwksUri = `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`;
  try {
    const response = await axios.get(jwksUri);
    res.json({
      success: true,
      keyCount: response.data.keys ? response.data.keys.length : 0
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || "Unknown Error"
    });
  }
});

// Fetch user profile AND manager in parallel from Graph API
const fetchGraphData = async (accessToken: string) => {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const [profileResult, managerResult] = await Promise.allSettled([
    axios.get("https://graph.microsoft.com/v1.0/me", {
      headers,
      params: { $select: "id,mail,userPrincipalName,displayName" },
    }),
    axios.get("https://graph.microsoft.com/v1.0/me/manager", {
      headers,
      params: { $select: "id" },
    }),
  ]);

  if (profileResult.status === "rejected") {
    throw new Error("Failed to fetch profile from Microsoft Graph API");
  }

  const managerEntraOid =
    managerResult.status === "fulfilled" ? (managerResult.value.data.id ?? null) : null;

  if (managerResult.status === "rejected") {
    console.warn("[SYNC] Could not fetch manager (non-fatal):", (managerResult.reason as any)?.message);
  }

  return { profile: profileResult.value.data, managerEntraOid };
};

router.post("/sync", async (req: Request, res: Response): Promise<void> => {
  console.log("[SYNC] Received sync request");
  const { accessToken, idToken } = req.body;

  if (!accessToken || !idToken) {
    console.error("[SYNC] Error: Access token or ID token missing");
    res.status(400).json({ error: "MISSING_ID_TOKEN", details: "Access token and ID token are required" });
    return;
  }

  try {
    console.log("[SYNC] 1. Fetching user data from Graph API...");
    let graphData;
    try {
      graphData = await fetchGraphData(accessToken);
    } catch (e: any) {
      res.status(401).json({ error: "GRAPH_API_FAILED", details: e.message });
      return;
    }
    const { profile, managerEntraOid } = graphData;
    
    console.log("[SYNC] 2. Verifying ID token signature...");
    
    const ENTRA_TENANT_ID = process.env.ENTRA_TENANT_ID;
    const ENTRA_CLIENT_ID = process.env.ENTRA_CLIENT_ID;

    if (!ENTRA_TENANT_ID || !ENTRA_CLIENT_ID) {
      res.status(500).json({ error: "SERVER_CONFIG_ERROR", details: "Missing Tenant or Client ID" });
      return;
    }

    // ─── Use module-level singleton JWKS client ────────────────────────────
    const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
      jwksSingleton.getSigningKey(header.kid, (err, key) => {
        if (err || !key) {
          if (err?.message?.includes("Bad Request") || err?.message?.includes("400")) {
             return callback(new Error("TENANT_NOT_FOUND"));
          }
          return callback(err || new Error("Key not found"));
        }
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
      });
    };

    let decodedIdToken;
    try {
      decodedIdToken = await new Promise<any>((resolve, reject) => {
        const verifyOptions: jwt.VerifyOptions = {
          algorithms: ["RS256"],
          audience: ENTRA_CLIENT_ID,
          issuer: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0`
        };

        jwt.verify(idToken, getKey, verifyOptions, (err, decoded: any) => {
          if (err) {
            if (err.message === "TENANT_NOT_FOUND") {
              reject({ code: "TENANT_NOT_FOUND", message: "Microsoft returned Bad Request for JWKS. Invalid Tenant ID?" });
            } else if (err.message.includes("audience invalid")) {
              reject({ code: "INVALID_AUDIENCE", message: err.message });
            } else if (err.message.includes("jwt issuer invalid")) {
              reject({ code: "INVALID_ISSUER", message: err.message });
            } else {
              reject({ code: "TOKEN_VERIFICATION_FAILED", message: err.message });
            }
          } else {
            resolve(decoded);
          }
        });
      });
    } catch (e: any) {
      console.error("[SYNC] ID token verification failed:", e.code || e.message);
      res.status(401).json({ error: e.code || "TOKEN_VERIFICATION_FAILED", details: e.message });
      return;
    }
    // Extract roles from Entra ID token — Graph API / token claims are the ONLY source of truth.
    // The resolved role is written to the DB on EVERY login (INSERT or UPDATE).
    const entraClaims: string[] = decodedIdToken?.roles || [];
    const syncedRole = seedRoleFromEntraClaims(entraClaims);
    
    // 3. Extract required fields
    const entra_oid = profile.id;
    const email = profile.mail || profile.userPrincipalName;
    const name = profile.displayName;
    
    // ─── Step 3: Upsert — role is ALWAYS written from Entra source ────────────
    console.log("[SYNC] 3. Upserting user in database (role always synced from Entra)...");
    const finalManagerOid = managerEntraOid && managerEntraOid.trim() !== "" ? managerEntraOid : null;

    const upsertQuery = `
      INSERT INTO users (
        entra_oid,
        email,
        name,
        role,
        manager_entra_oid,
        last_login
      )
      VALUES ($1, $2, $3, $4, NULLIF($5, ''), NOW())
      ON CONFLICT (entra_oid)
      DO UPDATE SET
        email = EXCLUDED.email,
        name  = EXCLUDED.name,
        role  = EXCLUDED.role,
        manager_entra_oid = CASE
          WHEN EXCLUDED.manager_entra_oid IS NOT NULL
          THEN EXCLUDED.manager_entra_oid
          ELSE users.manager_entra_oid
        END,
        last_login = NOW()
      RETURNING id, entra_oid, email, name, role, manager_entra_oid, is_active, created_at, last_login;
    `;
    
    let user;
    try {
      const { rows } = await query(upsertQuery, [
        entra_oid,
        email,
        name,
        syncedRole,
        finalManagerOid
      ]);
      user = rows[0];
      console.log(`[SYNC] Returned user.manager_entra_oid: ${user.manager_entra_oid}`);
    } catch (e: any) {
      console.error("[SYNC] Database upsert failed:", e.message);
      res.status(500).json({ error: "DATABASE_ERROR", details: e.message });
      return;
    }
    
    console.log("[SYNC] 4. Creating session cookie...");
    try {
      // JWT contains only identity — role is read from DB by requireAuth middleware
      const sessionToken = jwt.sign(
        {
          entra_oid: user.entra_oid,
          id:        user.id,
        },
        JWT_SECRET,
        { expiresIn: "8h" }
      );

      const isProd = process.env.NODE_ENV === "production";
      res.cookie("session_token", sessionToken, {
        httpOnly: true,
        secure:   isProd,
        sameSite: isProd ? "none" : "lax",
        path:     "/",
        maxAge:   24 * 60 * 60 * 1000 // 24 hours
      });

      // Invalidate in-memory user cache so next requireAuth gets fresh role
      invalidateUserCache(user.entra_oid);
    } catch (e: any) {
      console.error("[SYNC] Session cookie creation failed:", e.message);
      res.status(500).json({ error: "SESSION_CREATION_FAILED", details: e.message });
      return;
    }
    
    console.log("[SYNC] Sync completely successful");
    res.json({ message: "Sync successful", user });
  } catch (error: any) {
    console.error("[SYNC] Unexpected error:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", details: error.message });
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

router.post("/logout", requireAuth, (req: AuthRequest, res: Response) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("session_token", {
    httpOnly: true,
    secure:   isProd,
    sameSite: isProd ? "none" : "lax",
    path:     "/"
  });
  res.json({ message: "Logged out successfully" });
});

export default router;
