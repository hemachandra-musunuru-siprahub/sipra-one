import { Router, Response } from "express";
import { query } from "../../db";
import { requireAuth, AuthRequest, requireRole } from "../../middleware/auth";

const router = Router();

// Helper to get name
const getUserName = async (entraOid: string) => {
  const { rows } = await query("SELECT name FROM users WHERE entra_oid = $1", [entraOid]);
  return rows[0]?.name || "Unknown";
};

// Get direct reports for manager
router.get("/direct-reports", requireAuth, requireRole(["Manager", "SipraHub-Manager"]), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT entra_oid, name, email
      FROM users
      WHERE manager_entra_oid = $1
        AND is_active = true
      ORDER BY name ASC
    `, [req.user!.entra_oid]);
    res.json({ employees: rows });
  } catch (error: any) {
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// ─── GOALS ──────────────────────────────────────────────────────────────────

// Get all goals (HR/Admin)
router.get("/goals", requireAuth, requireRole(["HR", "Admin", "SipraHub-HR", "SipraHub-SystemAdmin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT g.*, e.name as employee_name, e.email as employee_email, m.name as manager_name
      FROM performance_goals g
      LEFT JOIN users e ON g.employee_oid = e.entra_oid
      LEFT JOIN users m ON g.manager_oid = m.entra_oid
      ORDER BY g.target_date ASC
    `);
    res.json({ goals: rows });
  } catch (error: any) {
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// Get my goals (Employee)
router.get("/goals/my", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT g.*, e.name as employee_name, m.name as manager_name
      FROM performance_goals g
      LEFT JOIN users e ON g.employee_oid = e.entra_oid
      LEFT JOIN users m ON g.manager_oid = m.entra_oid
      WHERE g.employee_oid = $1
      ORDER BY g.target_date ASC
    `, [req.user!.entra_oid]);
    res.json({ goals: rows });
  } catch (error: any) {
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// Get team goals (Manager)
router.get("/goals/team", requireAuth, requireRole(["Manager", "SipraHub-Manager"]), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT g.*, e.name as employee_name, m.name as manager_name
      FROM performance_goals g
      LEFT JOIN users e ON g.employee_oid = e.entra_oid
      LEFT JOIN users m ON g.manager_oid = m.entra_oid
      WHERE g.manager_oid = $1
      ORDER BY g.target_date ASC
    `, [req.user!.entra_oid]);
    res.json({ goals: rows });
  } catch (error: any) {
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// Create a goal
router.post("/goals", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const employee_oid = req.body.employee_oid || req.user!.entra_oid;
    const manager_oid = req.user!.entra_oid;
    const title = req.body.title;
    const description = req.body.description || null;
    const target_date = req.body.target_date;

    const { rows } = await query(`
      INSERT INTO performance_goals (
        employee_oid,
        manager_oid,
        title,
        description,
        target_date,
        status,
        progress_percent
      )
      VALUES ($1, $2, $3, $4, $5, 'not_started', 0)
      RETURNING *;
    `, [employee_oid, manager_oid, title, description, target_date]);
    
    res.status(201).json({ goal: rows[0] });
  } catch (error: any) {
    console.error("Error creating goal:", error);
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// Update a goal
router.put("/goals/:id", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    let { status, progress_percent } = req.body;
    
    if (progress_percent !== undefined) {
      if (progress_percent < 0 || progress_percent > 100) {
        res.status(400).json({ error: "INVALID_INPUT", details: "Progress percent must be between 0 and 100" });
        return;
      }

      status = 'not_started';
      if (progress_percent > 0 && progress_percent < 100) {
        status = 'in_progress';
      } else if (progress_percent === 100) {
        status = 'completed';
      }
    }

    const { rows: existingRows } = await query("SELECT employee_oid, manager_oid FROM performance_goals WHERE id = $1", [id]);
    if (existingRows.length === 0) {
       res.status(404).json({ error: "NOT_FOUND" });
       return;
    }

    const goal = existingRows[0];
    const isOwner = goal.employee_oid === req.user!.entra_oid;
    const isManager = goal.manager_oid === req.user!.entra_oid;
    const isHR = req.user?.roles?.includes("HR") || req.user?.roles?.includes("Admin") || req.user?.roles?.includes("SipraHub-HR") || req.user?.roles?.includes("SipraHub-SystemAdmin");

    if (!isOwner && !isManager && !isHR) {
      res.status(403).json({ error: "FORBIDDEN" });
      return;
    }

    const { rows } = await query(`
      UPDATE performance_goals
      SET 
        status = COALESCE($1, status),
        progress_percent = COALESCE($2, progress_percent),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [status, progress_percent, id]);

    res.json({ goal: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// Get employee summary for managers
router.get("/employee-summary", requireAuth, requireRole(["Manager", "SipraHub-Manager"]), async (req: AuthRequest, res: Response) => {
  try {
    const managerOid = req.user!.entra_oid;

    // 1. Get all employees under this manager by looking at their goals
    // We join with users to get the employee name
    const { rows: goalRows } = await query(`
      SELECT g.*, u.name as employee_name, u.email as employee_email
      FROM performance_goals g
      JOIN users u ON g.employee_oid = u.entra_oid
      WHERE g.manager_oid = $1
      ORDER BY u.name, g.target_date ASC
    `, [managerOid]);

    // 2. Get all reviews for these employees
    const { rows: reviewRows } = await query(`
      SELECT r.*, u.name as employee_name, rev.name as reviewer_name
      FROM performance_reviews r
      JOIN users u ON r.employee_oid = u.entra_oid
      JOIN users rev ON r.reviewer_oid = rev.entra_oid
      WHERE r.employee_oid IN (
        SELECT DISTINCT employee_oid FROM performance_goals WHERE manager_oid = $1
      )
      ORDER BY r.created_at DESC
    `, [managerOid]);

    // 3. Group the data by employee
    const summaryMap = new Map();

    goalRows.forEach(g => {
      if (!summaryMap.has(g.employee_oid)) {
        summaryMap.set(g.employee_oid, {
          employee_oid: g.employee_oid,
          employee_name: g.employee_name,
          employee_email: g.employee_email,
          total_goals: 0,
          completed_goals: 0,
          in_progress_goals: 0,
          not_started_goals: 0,
          total_progress: 0,
          goals: [],
          reviews: []
        });
      }

      const s = summaryMap.get(g.employee_oid);
      s.total_goals++;
      if (g.status === 'completed') s.completed_goals++;
      else if (g.status === 'in_progress') s.in_progress_goals++;
      else s.not_started_goals++;
      
      s.total_progress += (g.progress_percent || 0);
      s.goals.push(g);
    });

    reviewRows.forEach(r => {
      const s = summaryMap.get(r.employee_oid);
      if (s) {
        s.reviews.push(r);
      }
    });

    const summary = Array.from(summaryMap.values()).map(s => ({
      ...s,
      average_progress: s.total_goals > 0 ? Math.round(s.total_progress / s.total_goals) : 0
    }));

    res.json({ summary });
  } catch (error: any) {
    console.error("Error fetching employee summary:", error);
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// ─── REVIEWS ────────────────────────────────────────────────────────────────

// Get all reviews (HR/Admin)
router.get("/reviews", requireAuth, requireRole(["HR", "Admin", "SipraHub-HR", "SipraHub-SystemAdmin"]), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT r.*, e.name as employee_name, e.email as employee_email, m.name as reviewer_name
      FROM performance_reviews r
      LEFT JOIN users e ON r.employee_oid = e.entra_oid
      LEFT JOIN users m ON r.reviewer_oid = m.entra_oid
      ORDER BY r.created_at DESC
    `);
    res.json({ reviews: rows });
  } catch (error: any) {
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// Get my reviews (Employee)
router.get("/reviews/my", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT r.*, e.name as employee_name, m.name as reviewer_name
      FROM performance_reviews r
      LEFT JOIN users e ON r.employee_oid = e.entra_oid
      LEFT JOIN users m ON r.reviewer_oid = m.entra_oid
      WHERE r.employee_oid = $1
      ORDER BY r.created_at DESC
    `, [req.user!.entra_oid]);
    res.json({ reviews: rows });
  } catch (error: any) {
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// Get team reviews (Manager)
router.get("/reviews/team", requireAuth, requireRole(["Manager", "SipraHub-Manager"]), async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`
      SELECT r.*, e.name as employee_name, m.name as reviewer_name
      FROM performance_reviews r
      LEFT JOIN users e ON r.employee_oid = e.entra_oid
      LEFT JOIN users m ON r.reviewer_oid = m.entra_oid
      WHERE r.reviewer_oid = $1
      ORDER BY r.created_at DESC
    `, [req.user!.entra_oid]);
    res.json({ reviews: rows });
  } catch (error: any) {
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

// Create a review
router.post("/reviews", requireAuth, requireRole(["Manager", "HR", "Admin", "SipraHub-Manager", "SipraHub-HR", "SipraHub-SystemAdmin"]), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employee_oid, review_period, rating, strengths, improvements, comments } = req.body;
    
    if (!employee_oid || !review_period || rating === undefined) {
      res.status(400).json({ error: "MISSING_FIELDS", details: "employee_oid, review_period, and rating are required" });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ error: "INVALID_INPUT", details: "Rating must be between 1 and 5" });
      return;
    }

    const { rows } = await query(`
      INSERT INTO performance_reviews (employee_oid, reviewer_oid, review_period, rating, strengths, improvements, comments)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [employee_oid, req.user!.entra_oid, review_period, rating, strengths, improvements, comments]);
    
    res.status(201).json({ review: rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: "DB_ERROR", details: error.message });
  }
});

export default router;
