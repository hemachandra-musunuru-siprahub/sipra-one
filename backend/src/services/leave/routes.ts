import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, forbidden, badRequest, conflict, unprocessable } from "../../lib/errors";
import { isAdmin, isManager, HR_ROLES, MANAGER_ROLES, ADMIN_ROLES, canAccess } from "../../lib/roles";
import * as repo from "./repo";
import { getDirectReportOids } from "../users/repo";

const router = Router();

const calcWorkingDays = (start: string, end: string): number => {
  let count = 0;
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const requests = await repo.getOwnRequests(req.user!.entra_oid);
  res.json({ requests });
});

router.get("/all", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const requests = await repo.getAllRequests();
    res.json({ requests });
  }
);

router.get("/team", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const roles = req.user!.roles || [];
    if (!canAccess(roles, isManager)) throw forbidden("Managers only");
    const directReports = await getDirectReportOids(req.user!.entra_oid);
    const requests = await repo.getTeamRequests(directReports);
    res.json({ requests });
  }
);

router.get("/balances", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const balances = await repo.getBalances(req.user!.entra_oid, year);
    res.json({ balances, year });
  }
);

const CreateLeaveSchema = z.object({
  leaveType: z.enum(["annual", "sick", "unpaid", "other"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason:    z.string().optional(),
}).refine(d => new Date(d.startDate) <= new Date(d.endDate), {
  message: "start_date must be on or before end_date",
});

router.post("/", requireAuth, validate(CreateLeaveSchema),
  async (req: AuthRequest, res: Response) => {
    const { leaveType, startDate, endDate, reason } = req.body;
    const user = req.user!;
    if (!user.manager_entra_oid)
      throw unprocessable("NO_MANAGER_ASSIGNED", "No manager assigned. Contact system admin.");
    const totalDays = calcWorkingDays(startDate, endDate);
    if (leaveType === "annual" || leaveType === "sick") {
      const year = new Date(startDate).getFullYear();
      const balance = await repo.getBalance(user.entra_oid, leaveType, year);
      if (!balance || balance.remaining_days < totalDays)
        throw unprocessable("INSUFFICIENT_BALANCE", `Insufficient ${leaveType} leave balance`);
    }
    const request = await repo.createRequest(
      user.entra_oid, user.manager_entra_oid!, leaveType, startDate, endDate, totalDays, reason
    );
    res.status(201).json({ request });
  }
);

const ActionSchema = z.object({
  action:          z.enum(["approved", "rejected"]),
  rejectionReason: z.string().optional(),
}).refine(d => d.action !== "rejected" || !!d.rejectionReason, {
  message: "rejectionReason is required when rejecting",
});

router.patch("/:id", requireAuth, validate(ActionSchema),
  async (req: AuthRequest, res: Response) => {
    const roles = req.user!.roles || [];
    if (!canAccess(roles, isManager)) throw forbidden("Managers only");
    const leaveReq = await repo.findById(req.params.id);
    if (!leaveReq) throw notFound("Leave request not found");
    if (leaveReq.status !== "pending") throw conflict("Leave request is no longer pending");
    if (!isAdmin(roles)) {
      const reports = await getDirectReportOids(req.user!.entra_oid);
      if (!reports.includes(leaveReq.employee_oid)) throw forbidden("You can only action your direct reports");
    }
    let updated;
    if (req.body.action === "approved") {
      const year = new Date(leaveReq.start_date).getFullYear();
      updated = await repo.approveRequest(req.params.id, req.user!.entra_oid,
        leaveReq.employee_oid, leaveReq.leave_type, leaveReq.total_days, year);
    } else {
      updated = await repo.rejectRequest(req.params.id, req.user!.entra_oid, req.body.rejectionReason!);
    }
    res.json({ request: updated });
  }
);

router.delete("/:id", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const leaveReq = await repo.findById(req.params.id);
    if (!leaveReq) throw notFound("Leave request not found");
    if (leaveReq.employee_oid !== req.user!.entra_oid) throw forbidden("You can only cancel your own requests");
    if (leaveReq.status !== "pending") throw conflict("Only pending requests can be cancelled");
    const updated = await repo.cancelRequest(req.params.id);
    res.json({ request: updated });
  }
);

const SetBalanceSchema = z.object({
  leaveType: z.enum(["annual", "sick", "unpaid", "other"]),
  year:      z.number().int().min(2020).max(2100),
  totalDays: z.number().min(0).max(365),
});

router.patch("/balances/:employeeId", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  validate(SetBalanceSchema),
  async (req: AuthRequest, res: Response) => {
    const { leaveType, year, totalDays } = req.body;
    const balance = await repo.setBalance(req.params.employeeId, leaveType, year, totalDays);
    res.json({ balance });
  }
);

export default router;
