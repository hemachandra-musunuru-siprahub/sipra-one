import { Router, Response } from "express";
import { query } from "../../db";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { ADMIN_ROLES } from "../../lib/roles";

const router = Router();

// GET /api/admin/users/grouped-by-role
router.get("/users/grouped-by-role", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT id, entra_oid, email, name, effective_role, manager_entra_oid, is_active, last_login
      FROM users
      ORDER BY name ASC
    `);

    const groups: any = {
      hr: [],
      manager: [],
      employee: [],
      admin: []
    };

    rows.forEach((user: any) => {
      const role = user.effective_role || 'employee';
      if (groups[role]) {
        groups[role].push(user);
      } else {
        groups.employee.push(user);
      }
    });

    res.json(groups);
  } catch (error: any) {
    console.error("Error fetching grouped users:", error);
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Safety check: don't delete self
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
