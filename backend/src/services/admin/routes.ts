import { Router, Response } from "express";
import { query } from "../../db";
import { requireAuth, requireRole, AuthRequest, invalidateUserCache } from "../../middleware/auth";
import { ADMIN_ROLES } from "../../lib/roles";

const router = Router();

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// Returns a flat list of all users with their Entra-synced role.
// Roles here are read-only snapshots — they are always set by Entra on login.
//
router.get("/users", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT
        u.id, u.entra_oid, u.email, u.name,
        u.role,
        u.manager_entra_oid,
        m.name  AS manager_name,
        m.email AS manager_email,
        u.is_active, u.created_at, u.last_login
      FROM users u
      LEFT JOIN users m ON m.entra_oid = u.manager_entra_oid
      ORDER BY u.name ASC
    `);

    res.json({ users: rows });
  } catch (error: any) {
    console.error("[ADMIN /users] Error:", error);
    res.status(500).json({ error: "ADMIN_USERS_ERROR", details: error.message });
  }
});

// ─── GET /api/admin/users/grouped-by-role ────────────────────────────────────
// Returns users grouped by their Entra-synced role (for Admin Dashboard overview).
//
router.get("/users/grouped-by-role", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT id, entra_oid, email, name, role, manager_entra_oid, is_active, last_login
      FROM users
      ORDER BY name ASC
    `);

    const groups: Record<string, any[]> = {
      Admin:    [],
      HR:       [],
      Manager:  [],
      Employee: [],
    };

    rows.forEach((user: any) => {
      const bucket = groups[user.role];
      if (bucket) {
        bucket.push(user);
      } else {
        if (!groups._unknown) groups._unknown = [];
        groups._unknown.push(user);
      }
    });

    res.json({ groups, users: rows });
  } catch (error: any) {
    console.error("[ADMIN /grouped] Error:", error);
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// NOTE: PATCH /api/admin/users/:oid/role has been intentionally REMOVED.
// Roles are managed exclusively by Microsoft Entra ID and synchronized on every login.
// Local role editing is not permitted to prevent split-authority authorization bugs.

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

    invalidateUserCache(id);
    res.json({ message: "User account permanently removed from SipraHub" });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

export default router;
