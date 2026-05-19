import { Router, Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import dotenv from "dotenv";
import { query } from "../../db";
import { requireAuth, AuthRequest, invalidateUserCache } from "../../middleware/auth";
import { seedRoleFromEntraClaims } from "../../lib/roles";

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

router.get("/dev-login", async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV !== "development") {
    res.status(403).json({ error: "FORBIDDEN", details: "Dev login is only allowed in development mode" });
    return;
  }

  const { email } = req.query;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "MISSING_EMAIL", details: "Email query parameter is required" });
    return;
  }

  try {
    const { rows } = await query(
      "SELECT id, entra_oid, email, name, role, is_active FROM users WHERE email = $1 AND is_active = true",
      [email]
    );

    if (rows.length === 0) {
      res.status(404).json({ error: "USER_NOT_FOUND", details: `Active user with email ${email} not found in database` });
      return;
    }

    const user = rows[0];
    const sessionToken = jwt.sign(
      { entra_oid: user.entra_oid, id: user.id },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("session_token", sessionToken, {
      httpOnly: true,
      secure:   isProd,
      sameSite: isProd ? "strict" : "lax",
      path:     "/",
      maxAge:   24 * 60 * 60 * 1000
    });

    invalidateUserCache(user.entra_oid);

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const queryParams = new URLSearchParams({
      sync_dev: "true",
      id: String(user.id),
      entra_oid: user.entra_oid,
      email: user.email,
      name: user.name,
      role: user.role
    }).toString();
    res.redirect(`${frontendUrl}/login?${queryParams}`);
  } catch (err: any) {
    res.status(500).json({ error: "SERVER_ERROR", details: err.message });
  }
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
      params: { $select: "id,mail,userPrincipalName,displayName,department" },
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
 * - Seeds the application role from Entra claims ONLY for new users (INSERT)
 * - Subsequent role changes are managed by Admins via the SipraHub Admin UI
 * - Issues a slim httpOnly session cookie (identity only, no roles)
 */
router.post("/sync", async (req: Request, res: Response): Promise<void> => {
  const startTotal = Date.now();
  console.log("[SYNC] Received sync request");
  const { accessToken, idToken } = req.body;

  if (!accessToken || !idToken) {
    res.status(400).json({ error: "MISSING_TOKENS", details: "Access token and ID token are required" });
    return;
  }

  // Parallelize Graph API fetch and Token Verification
  const startGraphAndVerify = Date.now();
  let graphDataPromise = fetchGraphData(accessToken).catch(e => ({ error: e }));
  
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

  let verifyPromise = new Promise<any>((resolve, reject) => {
    const startVerify = Date.now();
    jwt.verify(
      idToken,
      getKey,
      { algorithms: ["RS256"], audience: ENTRA_CLIENT_ID, issuer: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0` },
      (err, decoded: any) => {
        console.log(`[SYNC] Token Verify Time: ${Date.now() - startVerify}ms`);
        if (err) {
          if (err.message === "TENANT_NOT_FOUND") reject({ code: "TENANT_NOT_FOUND", message: "Invalid Tenant ID?" });
          else if (err.message.includes("audience invalid")) reject({ code: "INVALID_AUDIENCE", message: err.message });
          else if (err.message.includes("jwt issuer invalid")) reject({ code: "INVALID_ISSUER", message: err.message });
          else reject({ code: "TOKEN_VERIFICATION_FAILED", message: err.message });
        } else {
          resolve(decoded);
        }
      }
    );
  });

  let graphData, decodedIdToken;
  try {
    [graphData, decodedIdToken] = await Promise.all([graphDataPromise, verifyPromise]);
  } catch (e: any) {
    console.error("[SYNC] Parallel verification failed:", e.code || e.message);
    res.status(401).json({ error: e.code || "TOKEN_VERIFICATION_FAILED", details: e.message });
    return;
  }

  if ((graphData as any).error) {
    res.status(401).json({ error: "GRAPH_API_FAILED", details: (graphData as any).error.message });
    return;
  }

  const { profile, managerEntraOid } = graphData as any;

  // 3. Resolve role from Entra claims — Graph API is the ONLY source of truth.
  // Role is written to DB on EVERY login (INSERT or UPDATE).
  const entraClaims: string[] = decodedIdToken?.roles || [];
  const syncedRole = seedRoleFromEntraClaims(entraClaims);

  console.log(`[SYNC] --- ROLE SYNC ---`);
  console.log(`[SYNC] User: ${profile.mail || profile.userPrincipalName}`);
  console.log(`[SYNC] Entra claims: ${JSON.stringify(entraClaims)}`);
  console.log(`[SYNC] Synced role (always from Entra): ${syncedRole}`);

  // 4. Upsert profile — role ALWAYS written from Entra on every login
  const entra_oid = profile.id;
  const email = profile.mail || profile.userPrincipalName;
  const name = profile.displayName;
  const department = profile.department || null;
  const finalManagerOid = managerEntraOid && managerEntraOid.trim() !== "" ? managerEntraOid : null;

  console.log("[SYNC] 3. Upserting user (role always synced from Entra)...");
  const upsertQuery = `
    INSERT INTO users (
      entra_oid,
      email,
      name,
      role,
      manager_entra_oid,
      department,
      last_login
    )
    VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, NOW())
    ON CONFLICT (entra_oid)
    DO UPDATE SET
      email = EXCLUDED.email,
      name  = EXCLUDED.name,
      role  = EXCLUDED.role,
      department = EXCLUDED.department,
      manager_entra_oid = CASE
        WHEN EXCLUDED.manager_entra_oid IS NOT NULL
        THEN EXCLUDED.manager_entra_oid
        ELSE users.manager_entra_oid
      END,
      last_login = NOW()
    RETURNING id, entra_oid, email, name, role, department, manager_entra_oid, is_active, created_at, last_login;
  `;

  let user;
  try {
    const { rows } = await query(upsertQuery, [entra_oid, email, name, syncedRole, finalManagerOid, department]);
    user = rows[0];
    console.log(`[SYNC] user.role from DB: ${user.role}`);
  } catch (e: any) {
    console.error("[SYNC] Database upsert failed:", e.message);
    res.status(500).json({ error: "DATABASE_ERROR", details: e.message });
    return;
  }

  console.log("[SYNC] 4. Creating session cookie...");
  try {
    // JWT contains only identity — role is read from DB by requireAuth middleware
    const sessionToken = jwt.sign(
      { entra_oid: user.entra_oid, id: user.id },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("session_token", sessionToken, {
      httpOnly: true,
      secure:   isProd,
      sameSite: isProd ? "strict" : "lax",
      path:     "/",
      maxAge:   24 * 60 * 60 * 1000
    });

    // Bust the cache so next requireAuth picks up the fresh DB record
    invalidateUserCache(user.entra_oid);
  } catch (e: any) {
    console.error("[SYNC] Session cookie creation failed:", e.message);
    res.status(500).json({ error: "SESSION_CREATION_FAILED", details: e.message });
    return;
  }

  console.log("[SYNC] Sync completely successful");
  res.json({ message: "Sync successful", user });
});

// GET /api/auth/me — returns DB profile + role from session cookie
router.get("/me", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post("/logout", requireAuth, async (req: AuthRequest, res: Response) => {
  const startTotal = Date.now();
  const startSessionDestruction = Date.now();
  res.clearCookie("session_token");
  console.log(`[LOGOUT] Session Destruction Time: ${Date.now() - startSessionDestruction}ms`);
  console.log(`[LOGOUT] Total Request Time: ${Date.now() - startTotal}ms`);
  res.json({ message: "Logged out successfully" });
});

export default router;
