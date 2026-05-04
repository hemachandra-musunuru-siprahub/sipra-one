import { Router, Response } from "express";
import { query } from "../../db";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { ADMIN_ROLES } from "../../lib/roles";

const router = Router();

/**
 * GET /api/admin/users
 *
 * Returns all users as a flat list.
 * Roles are managed by Entra ID — the database stores only identity/profile data.
 * The frontend should display role information from the user's own session context.
 */
router.get("/users", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  try {
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

/**
 * GET /api/admin/users/grouped-by-role
 *
 * Kept for backwards compatibility with the Admin Dashboard.
 * Since roles are not stored in the DB, all users are returned under a single
 * "all" key. The Admin Dashboard should be updated to use the flat list.
 *
 * Returns: { users: [...] } — flat, sorted by name.
 */
router.get("/users/grouped-by-role", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT id, entra_oid, email, name, manager_entra_oid, is_active, last_login
      FROM users
      ORDER BY name ASC
    `);

    // Roles are not in the DB. Return flat list; frontend groups by session role where needed.
    res.json({ users: rows });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// DELETE /api/admin/users/:id
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
