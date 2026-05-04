import { Router, Response } from "express";
import { query } from "../../db";
import { requireAuth, AuthRequest } from "../../middleware/auth";

const router = Router();

// GET /api/employee/dashboard-summary
router.get("/dashboard-summary", requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entraOid = req.user?.entra_oid;

    if (!entraOid) {
      res.status(401).json({ error: "UNAUTHORIZED", details: "No user ID found" });
      return;
    }

    // 1. Fetch leave balances
    const { rows: leaveBalances } = await query(
      "SELECT leave_type, total_days, used_days, remaining_days FROM leave_balances WHERE employee_oid = $1",
      [entraOid]
    );

    // 2. Fetch counts (documents & announcements)
    // Assuming 'published' is the status for active documents/announcements
    const { rows: docCounts } = await query(
      "SELECT count(*) FROM hr_documents"
    );
    const { rows: annCounts } = await query(
      "SELECT count(*) FROM announcements"
    );

    const counts = {
      documents: parseInt(docCounts[0].count, 10),
      announcements: parseInt(annCounts[0].count, 10)
    };

    res.json({ leaveBalances, counts });
  } catch (error: any) {
    console.error("[Employee Dashboard] Error fetching summary:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", details: error.message });
  }
});

export default router;
