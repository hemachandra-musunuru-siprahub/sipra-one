import { Router, Response } from "express";
import { requireAuth } from "../../middleware/auth";
import { AuthRequest } from "../../middleware/auth";
import { forbidden } from "../../lib/errors";
import { canAccess, isManager } from "../../lib/roles";
import { getDirectReportsFull } from "../users/repo";

const router = Router();

// ─── GET /api/manager/team-members ───────────────────────────────────────────
router.get("/team-members", requireAuth, async (req: AuthRequest, res: Response) => {
  const role = req.user!.role;
  if (!canAccess(role, isManager)) throw forbidden("Managers only");

  const members = await getDirectReportsFull(req.user!.entra_oid);
  res.json(members);
});

export default router;
