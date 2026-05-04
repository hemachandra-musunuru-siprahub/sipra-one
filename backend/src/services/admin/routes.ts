import { Router, Response } from "express";
import { query } from "../../db";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { ADMIN_ROLES } from "../../lib/roles";
import { batchGetUserRoles, getUserRoleFromGraph } from "../../lib/graphClient";

const router = Router();

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// Returns a flat list of all users with roleFromEntra resolved from Microsoft
// Graph using app-level (client credentials) authentication.
//
// If ENTRA_CLIENT_SECRET is not set, roleFromEntra will be null and the
// frontend will show "Not Synced" instead of a wrong default.
//
router.get("/users", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  try {
    console.log("[ADMIN /users] Fetching all users from database...");
    const { rows } = await query(`
      SELECT id, entra_oid, email, name, manager_entra_oid, is_active, created_at, last_login
      FROM users
      ORDER BY name ASC
    `);

    console.log(`[ADMIN /users] ${rows.length} user(s) found. Resolving Entra roles via Microsoft Graph...`);

    // Fetch all unique manager OIDs to identify who is a manager in our DB
    const { rows: managerOids } = await query("SELECT DISTINCT manager_entra_oid FROM users WHERE manager_entra_oid IS NOT NULL");
    const managerSet = new Set(managerOids.map((r: any) => r.manager_entra_oid));

    // Resolve roles from Graph for every user (batched, concurrency-capped)
    const roleMap = await batchGetUserRoles(
      rows.map((u: any) => ({ entra_oid: u.entra_oid, email: u.email }))
    );

    const users = rows.map((u: any) => {
      let role = roleMap[u.entra_oid];

      // If Graph says 'employee' but they are a manager of someone in our DB, upgrade to 'manager'
      if (role === "employee" && managerSet.has(u.entra_oid)) {
        role = "manager";
      }

      return {
        id:                u.id,
        entra_oid:         u.entra_oid,
        email:             u.email,
        name:              u.name,
        manager_entra_oid: u.manager_entra_oid,
        is_active:         u.is_active,
        created_at:        u.created_at,
        last_login:        u.last_login,
        // null  → Graph unavailable (show "Not Synced")
        // value → actual Entra role
        roleFromEntra:     role,
      };
    });

    console.log("[ADMIN /users] Role resolution complete. Returning users.");
    res.json({ users });
  } catch (error: any) {
    console.error("[ADMIN /users] Error:", error);
    res.status(500).json({ error: "ADMIN_USERS_ERROR", details: error.message });
  }
});

// ─── Debug Handlers (Admin Only) ──────────────────────────────────────────

async function handleDebugGraphConfig(req: any, res: Response) {
  try {
    const tenantId = process.env.ENTRA_TENANT_ID;
    const clientId = process.env.ENTRA_CLIENT_ID;
    const secret   = process.env.ENTRA_CLIENT_SECRET;

    const config = {
      tenant_id_set: !!tenantId,
      client_id_set: !!clientId,
      secret_set:    !!secret && secret !== "your_client_secret_if_used",
      secret_length: secret?.length || 0,
      env:           process.env.NODE_ENV
    };

    let tokenAcquired = false;
    let tokenError    = null;
    let testCall      = null;

    try {
      const { getAppToken } = await import("../../lib/graphClient");
      const token = await getAppToken();
      tokenAcquired = true;
      
      try {
        const { default: axios } = await import("axios");
        const graphRes = await axios.get("https://graph.microsoft.com/v1.0/users?$top=1", {
          headers: { Authorization: `Bearer ${token}` }
        });
        testCall = { status: graphRes.status, count: graphRes.data.value?.length };
      } catch (e: any) {
        testCall = { 
          status: e.response?.status, 
          error: e.response?.data?.error?.code,
          message: e.response?.data?.error?.message
        };
      }
    } catch (e: any) {
      tokenError = e.message;
    }

    res.json({ 
      config, 
      token_acquired: tokenAcquired, 
      token_error: tokenError, 
      test_call: testCall 
    });
  } catch (error: any) {
    res.status(500).json({ error: "DEBUG_GRAPH_ERROR", details: error.message });
  }
}

async function handleDebugRole(req: any, res: Response) {
  try {
    const { entraOid } = req.params;
    console.log(`[ADMIN /debug-role] Debugging role for ${entraOid}...`);

    const { rows } = await query("SELECT email, name FROM users WHERE entra_oid = $1", [entraOid]);
    const dbUser = rows[0] || { email: "unknown", name: "unknown" };

    const debugInfo = await getUserRoleFromGraph(entraOid, dbUser.email, true);
    
    res.json({
      db_info: dbUser,
      entra_oid: entraOid,
      graph_debug: debugInfo
    });
  } catch (error: any) {
    console.error("[ADMIN /debug-role] Error:", error);
    res.status(500).json({ error: "DEBUG_ROLE_ERROR", details: error.message });
  }
}

// ─── GET /api/admin/debug-graph-config ──────────────────────────────────
router.get("/debug-graph-config", requireAuth, requireRole([...ADMIN_ROLES]), handleDebugGraphConfig);

// ─── GET /api/admin/debug-role/:entraOid ───────────────────────────────────
router.get("/debug-role/:entraOid", requireAuth, requireRole([...ADMIN_ROLES]), handleDebugRole);

// ─── GET /api/admin/users/grouped-by-role ────────────────────────────────────
// Returns users grouped by their Entra role (for the Admin Dashboard overview).
// Also uses Graph for role resolution.
//
router.get("/users/grouped-by-role", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  try {
    console.log("[ADMIN /grouped] Fetching all users...");
    const { rows } = await query(`
      SELECT id, entra_oid, email, name, manager_entra_oid, is_active, last_login
      FROM users
      ORDER BY name ASC
    `);
    res.json({ users: rows });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

    console.log(`[ADMIN /grouped] ${rows.length} user(s). Resolving Entra roles...`);

    // Fetch all unique manager OIDs to identify who is a manager in our DB
    const { rows: managerOids } = await query("SELECT DISTINCT manager_entra_oid FROM users WHERE manager_entra_oid IS NOT NULL");
    const managerSet = new Set(managerOids.map((r: any) => r.manager_entra_oid));

    const roleMap = await batchGetUserRoles(
      rows.map((u: any) => ({ entra_oid: u.entra_oid, email: u.email }))
    );

    const groups: Record<string, any[]> = {
      admin:    [],
      hr:       [],
      manager:  [],
      employee: [],
      unknown:  [], // Graph unavailable / null role
    };

    rows.forEach((user: any) => {
      let role = roleMap[user.entra_oid];

      // If Graph says 'employee' but they are a manager of someone in our DB, upgrade to 'manager'
      if (role === "employee" && managerSet.has(user.entra_oid)) {
        role = "manager";
      }

      const decorated = { ...user, roleFromEntra: role };
      if (role && groups[role]) {
        groups[role].push(decorated);
      } else {
        groups.unknown.push(decorated);
      }
    });

    // Roles are not in the DB. Return flat list; frontend groups by session role where needed.
    res.json({ users: rows });
  } catch (error: any) {
    console.error("[ADMIN /grouped] Error:", error);
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete("/users/:id", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (id === req.user?.entra_oid) {
      res.status(400).json({ error: "BAD_REQUEST", details: "You cannot delete your own account" });
      return;
    }

    const { rowCount } = await query("DELETE FROM users WHERE entra_oid = $1", [id]);

    if (rowCount === 0) {
      res.status(404).json({ error: "NOT_FOUND", details: "User not found" });
      return;
    }

    res.json({ message: "User account permanently removed from SipraHub" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

export default router;
