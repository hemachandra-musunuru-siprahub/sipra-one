import { Router, Request, Response } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import dotenv from "dotenv";
import { query } from "../../db";
import { requireAuth, AuthRequest } from "../../middleware/auth";

dotenv.config();

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_jwt_key_change_me";

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

// Fetch user profile and manager from Graph API using the access token
const fetchGraphData = async (accessToken: string) => {
  try {
    const profileResponse = await axios.get("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { $select: "id,mail,userPrincipalName,displayName" }
    });
    
    let managerEntraOid = null;
    try {
      const managerResponse = await axios.get("https://graph.microsoft.com/v1.0/me/manager", {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { $select: "id" }
      });
      managerEntraOid = managerResponse.data.id;
    } catch (e: any) {
      console.warn("Could not fetch manager for user", e.message);
    }
    
    return { profile: profileResponse.data, managerEntraOid };
  } catch (error) {
    throw new Error("Failed to fetch data from Microsoft Graph API");
  }
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

    const jwksUri = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/discovery/v2.0/keys`;

    const client = jwksClient({
      jwksUri: jwksUri,
      cache: true,
      rateLimit: true
    });

    const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
      client.getSigningKey(header.kid, (err, key) => {
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
    console.log(`[SYNC] Mapped effective_role: ${effectiveRole}`);
    console.log(`[SYNC] --------------------------`);

    // 3. Extract required fields for profile cache
    const entra_oid = profile.id;
    const email = profile.mail || profile.userPrincipalName;
    const name = profile.displayName;
    
    console.log(`[SYNC] 3. Syncing user data: email=${email}, role=${effectiveRole}`);

    let existingUser;
    try {
      const { rows } = await query("SELECT manager_entra_oid FROM users WHERE entra_oid = $1", [entra_oid]);
      existingUser = rows[0];
    } catch (e: any) {
      console.error("[SYNC] Failed to fetch existing user:", e.message);
    }

    const finalManagerOid =
      managerEntraOid && managerEntraOid.trim() !== ""
        ? managerEntraOid
        : existingUser?.manager_entra_oid || null;

    console.log(`[SYNC] Manager OID resolution - existing: ${existingUser?.manager_entra_oid || 'none'}, from graph: ${managerEntraOid || 'none'}, final result: ${finalManagerOid || 'none'}`);

    console.log("[SYNC] 3. Creating/updating user profile cache in database...");
    const upsertQuery = `
      INSERT INTO users (
        entra_oid,
        email,
        name,
        manager_entra_oid,
        effective_role,
        role_source,
        azure_groups,
        last_login
      )
      VALUES ($1, $2, $3, NULLIF($4, ''), $5, 'entra', $6, NOW())
      ON CONFLICT (entra_oid) 
      DO UPDATE SET 
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        manager_entra_oid = CASE
          WHEN EXCLUDED.manager_entra_oid IS NOT NULL
          THEN EXCLUDED.manager_entra_oid
          ELSE users.manager_entra_oid
        END,
        effective_role = EXCLUDED.effective_role,
        role_source = EXCLUDED.role_source,
        azure_groups = EXCLUDED.azure_groups,
        last_login = NOW()
      RETURNING id, entra_oid, email, name, manager_entra_oid, effective_role, is_active, created_at, last_login;
    `;
    
    let user;
    try {
      const { rows } = await query(upsertQuery, [
        entra_oid, 
        email, 
        name, 
        finalManagerOid,
        effectiveRole,
        JSON.stringify(appRoles)
      ]);
      user = rows[0];
      console.log(`[SYNC] Database upsert successful: user_id=${user.id}, entra_oid=${user.entra_oid}`);
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

      // Add roles to user object for response
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
});

router.get("/me", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

router.post("/logout", requireAuth, (req: AuthRequest, res: Response) => {
  res.clearCookie("session_token");
  res.json({ message: "Logged out successfully" });
});

export default router;
