import { Router, Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import dotenv from "dotenv";
import { query } from "../../db";
import { requireAuth, AuthRequest } from "../../middleware/auth";
import { getEffectiveRole } from "../../lib/roles";

dotenv.config();

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_change_me";

// ─── JWKS singleton ────────────────────────────────────────────────────────────
const jwksSingleton = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 10,
  cacheMaxAge: 10 * 60 * 1000,
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
    res.json({ success: true, keyCount: response.data.keys?.length ?? 0 });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message, details: error.response?.data });
  }
});

// ─── Fetch user profile + manager from Graph API ──────────────────────────────
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

/**
 * POST /api/auth/sync
 *
 * Called by the frontend after Entra SSO login.
 * - Verifies the Entra ID token (JWT signature via JWKS)
 * - Reads roles ONLY from the verified ID token claims
 * - Upserts the user's profile cache (identity only — no role columns)
 * - Issues an httpOnly session cookie containing the Entra roles
 *
 * The database stores NO role data. Roles live exclusively in the session JWT.
 */
router.post("/sync", async (req: Request, res: Response): Promise<void> => {
  console.log("[SYNC] Received sync request");
  const { accessToken, idToken } = req.body;

  if (!accessToken || !idToken) {
    res.status(400).json({ error: "MISSING_TOKENS", details: "Access token and ID token are required" });
    return;
  }

  // 1. Fetch profile + manager from Graph API
  console.log("[SYNC] 1. Fetching user data from Graph API...");
  let graphData;
  try {
    graphData = await fetchGraphData(accessToken);
  } catch (e: any) {
    res.status(401).json({ error: "GRAPH_API_FAILED", details: e.message });
    return;
  }
  const { profile, managerEntraOid } = graphData;

  // 2. Verify ID token signature via Entra JWKS
  console.log("[SYNC] 2. Verifying ID token signature...");
  const ENTRA_TENANT_ID = process.env.ENTRA_TENANT_ID;
  const ENTRA_CLIENT_ID = process.env.ENTRA_CLIENT_ID;

  if (!ENTRA_TENANT_ID || !ENTRA_CLIENT_ID) {
    res.status(500).json({ error: "SERVER_CONFIG_ERROR", details: "Missing Tenant or Client ID" });
    return;
  }

  const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
    jwksSingleton.getSigningKey(header.kid, (err, key) => {
      if (err || !key) {
        if (err?.message?.includes("Bad Request") || err?.message?.includes("400")) {
          return callback(new Error("TENANT_NOT_FOUND"));
        }
        return callback(err || new Error("Key not found"));
      }
      callback(null, key.getPublicKey());
    });
  };

  let decodedIdToken: any;
  try {
    decodedIdToken = await new Promise<any>((resolve, reject) => {
      jwt.verify(
        idToken,
        getKey,
        { algorithms: ["RS256"], audience: ENTRA_CLIENT_ID, issuer: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0` },
        (err, decoded: any) => {
          if (err) {
            if (err.message === "TENANT_NOT_FOUND") reject({ code: "TENANT_NOT_FOUND", message: "Invalid Tenant ID?" });
            else if (err.message.includes("audience invalid")) reject({ code: "INVALID_AUDIENCE", message: err.message });
            else if (err.message.includes("jwt issuer invalid")) reject({ code: "INVALID_ISSUER", message: err.message });
            else reject({ code: "TOKEN_VERIFICATION_FAILED", message: err.message });
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

    // Roles are extracted from ID token but NOT stored in DB
    let appRoles: string[] = decodedIdToken?.roles || [];
    if (appRoles.length === 0 && process.env.NODE_ENV !== "production") {
      appRoles = ["Admin", "HR", "Manager", "Employee", "SipraHub-HR"];
    }
    
    // Calculate effective role based on Entra App Roles / Groups
    let effectiveRole = 'employee';
    
    const hasAdmin = appRoles.some(r => ['Admin', 'SipraHub-SystemAdmin', 'SipraHub_Admin'].includes(r));
    const hasHR    = appRoles.some(r => ['HR', 'SipraHub-HR', 'SipraHub_HR'].includes(r));
    const hasMgr   = appRoles.some(r => ['Manager', 'SipraHub-Manager', 'SipraHub_Manager'].includes(r));
    const hasEmp   = appRoles.some(r => ['Employee', 'SipraHub-Employee', 'SipraHub_Employee'].includes(r));

    if (hasAdmin) effectiveRole = 'admin';
    else if (hasHR) effectiveRole = 'hr';
    else if (hasMgr) effectiveRole = 'manager';
    else if (hasEmp) effectiveRole = 'employee';

    console.log(`[SYNC] --- ROLE MAPPING DEBUG ---`);
    console.log(`[SYNC] User: ${profile.mail || profile.userPrincipalName}`);
    console.log(`[SYNC] Entra roles received: ${JSON.stringify(appRoles)}`);
    console.log(`[SYNC] Mapped roleFromEntra: ${effectiveRole}`);
    console.log(`[SYNC] --------------------------`);

  // 3. Extract roles from ID token — Entra is the ONLY source of truth
  //    In dev with no app roles assigned, fall back to a full set for testing.
  let appRoles: string[] = decodedIdToken?.roles || [];
  if (appRoles.length === 0 && process.env.NODE_ENV !== "production") {
    appRoles = ["Admin", "HR", "Manager", "Employee"];
    console.warn("[SYNC] No Entra app roles found — using dev fallback roles:", appRoles);
  }

  // Compute effective_role from priority hierarchy (never persisted to DB)
  const effective_role = getEffectiveRole(appRoles);

  console.log(`[SYNC] --- ROLE MAPPING ---`);
  console.log(`[SYNC] User: ${profile.mail || profile.userPrincipalName}`);
  console.log(`[SYNC] Entra roles: ${JSON.stringify(appRoles)}`);
  console.log(`[SYNC] Effective role (computed, not stored): ${effective_role}`);

  // 4. Upsert identity profile cache — NO role columns written
  const entra_oid = profile.id;
  const email = profile.mail || profile.userPrincipalName;
  const name = profile.displayName;
  const finalManagerOid = managerEntraOid && managerEntraOid.trim() !== "" ? managerEntraOid : null;

    console.log("[SYNC] 3. Creating/updating user profile cache in database...");
    const upsertQuery = `
      INSERT INTO users (
        entra_oid,
        email,
        name,
        manager_entra_oid,
        last_login
      )
      VALUES ($1, $2, $3, NULLIF($4, ''), NOW())
      ON CONFLICT (entra_oid) 
      DO UPDATE SET 
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        manager_entra_oid = CASE
          WHEN EXCLUDED.manager_entra_oid IS NOT NULL
          THEN EXCLUDED.manager_entra_oid
          ELSE users.manager_entra_oid
        END,
        last_login = NOW()
      RETURNING id, entra_oid, email, name, manager_entra_oid, is_active, created_at, last_login;
    `;
    
    let user;
    try {
      const { rows } = await query(upsertQuery, [
        entra_oid, 
        email, 
        name, 
        finalManagerOid
      ]);
      user = rows[0];
      console.log(`[SYNC] Returned user.manager_entra_oid: ${user.manager_entra_oid}`);
    } catch (e: any) {
      console.error("[SYNC] Database upsert failed:", e.message);
      res.status(500).json({ error: "DATABASE_ERROR", details: e.message });
      return;
    }
    
    console.log("[SYNC] 4. Creating session cookie with roles...");
    try {
      // Include roles directly in the JWT session token
      const sessionToken = jwt.sign(
        { 
          entra_oid: user.entra_oid, 
          id: user.id,
          roles: appRoles 
        }, 
        JWT_SECRET, 
        { expiresIn: "8h" }
      );
      
      const isProd = process.env.NODE_ENV === "production";
      res.cookie("session_token", sessionToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "strict" : "lax",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Add roles to user object for response (Dynamic from Entra, not DB)
      user.roleFromEntra = effectiveRole;
      user.roles = appRoles;
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

  console.log("[SYNC] Sync successful");
  // Return user profile + roles + computed effective_role to frontend
  res.json({
    message: "Sync successful",
    user: { ...user, roles: appRoles, effective_role },
  });
});

// GET /api/auth/me — returns DB profile + roles from session cookie
router.get("/me", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post("/logout", requireAuth, (req: AuthRequest, res: Response) => {
  res.clearCookie("session_token");
  res.json({ message: "Logged out successfully" });
});

export default router;
