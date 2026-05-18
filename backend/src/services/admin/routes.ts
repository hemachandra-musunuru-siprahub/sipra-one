import { Router, Response } from "express";
import { query } from "../../db";
import { requireAuth, requireRole, AuthRequest, invalidateUserCache } from "../../middleware/auth";
import { ADMIN_ROLES } from "../../lib/roles";
import { initTimesheetJobs, runFridayReminder, runMondayReminder } from "../../jobs/timesheetReminders";

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

// ─── GET /api/admin/settings/timesheet-reminders ─────────────────────────────────
router.get("/settings/timesheet-reminders", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'timesheet_reminders'`
    );
    if (rows.length === 0) {
      return res.json({
        settings: {
          friday_enabled: true,
          friday_time: "15:00",
          monday_enabled: true,
          monday_time: "09:00"
        }
      });
    }
    res.json({ settings: rows[0].setting_value });
  } catch (error: any) {
    console.error("[ADMIN GET settings] Error:", error);
    res.status(500).json({ error: "ADMIN_SETTINGS_GET_ERROR", details: error.message });
  }
});

// ─── PATCH /api/admin/settings/timesheet-reminders ───────────────────────────────
router.patch("/settings/timesheet-reminders", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  try {
    const { friday_enabled, friday_time, monday_enabled, monday_time } = req.body;

    if (
      typeof friday_enabled !== "boolean" ||
      typeof monday_enabled !== "boolean" ||
      !friday_time ||
      !monday_time
    ) {
      return res.status(400).json({ error: "BAD_REQUEST", details: "Invalid settings payload" });
    }

    const newValue = {
      friday_enabled,
      friday_time,
      monday_enabled,
      monday_time
    };

    await query(
      `INSERT INTO system_settings (setting_key, setting_value, updated_at)
       VALUES ('timesheet_reminders', $1, NOW())
       ON CONFLICT (setting_key) DO UPDATE
       SET setting_value = $1, updated_at = NOW()`,
      [newValue]
    );

    // Reschedule cron jobs
    await initTimesheetJobs();

    res.json({ message: "Timesheet reminder settings updated successfully", settings: newValue });
  } catch (error: any) {
    console.error("[ADMIN PATCH settings] Error:", error);
    res.status(500).json({ error: "ADMIN_SETTINGS_PATCH_ERROR", details: error.message });
  }
});

// ─── POST /api/admin/settings/timesheet-reminders/trigger ───────────────────────
router.post("/settings/timesheet-reminders/trigger", requireAuth, requireRole([...ADMIN_ROLES]), async (req: AuthRequest, res: Response) => {
  const { type } = req.body;
  try {
    if (type === "friday") {
      await runFridayReminder();
      return res.json({ message: "Friday reminders triggered manually" });
    } else if (type === "monday") {
      await runMondayReminder();
      return res.json({ message: "Monday reminders triggered manually" });
    } else {
      return res.status(400).json({ error: "BAD_REQUEST", details: "Invalid trigger type. Must be 'friday' or 'monday'" });
    }
  } catch (error: any) {
    console.error("[ADMIN TRIGGER settings] Error:", error);
    res.status(500).json({ error: "ADMIN_TRIGGER_ERROR", details: error.message });
  }
});

export default router;
