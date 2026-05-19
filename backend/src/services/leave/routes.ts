import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, forbidden, conflict, unprocessable } from "../../lib/errors";
import { isAdmin, isManager, isHR, HR_ROLES, MANAGER_ROLES, ADMIN_ROLES, canAccess } from "../../lib/roles";
import * as repo from "./repo";
import { getDirectReportOids } from "../users/repo";
import * as notifRepo from "../notifications/repo";
import { emitNotification, getSocketServer } from "../../lib/socketServer";
import { query } from "../../db";
import { createLeaveTimesheetEntries } from "../timesheets/repo";
import { runMonthlyLeaveCredit, runYearEndLeaveExpiry } from "../../jobs/leaveCredits";

const router = Router();

// ─── Ensure leave_request constraint allows all leave types ───────────────────
(async () => {
  try {
    await query(`ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS chk_leave_type`);
    await query(`ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS chk_leave_requests`);
    await query(`ALTER TABLE leave_requests ADD CONSTRAINT chk_leave_type CHECK (leave_type IN ('casual', 'sick', 'unpaid'))`);
  } catch (err) {
    console.error("[LEAVE SETUP ERROR]:", err);
  }
})();


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
  const { month } = req.query as { month?: string };
  const requests = await repo.getOwnRequests(req.user!.entra_oid, { month });
  res.json({ requests });
});

/**
 * GET /api/leave-requests/all
 *
 * Role-aware, server-side filtered:
 *   - HR / Admin  → all leave requests in the system (unfiltered)
 *   - Manager     → only requests where manager_oid = caller's Entra OID
 *
 * No client-side filtering is needed or expected.
 */
router.get("/all", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES, ...MANAGER_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const roles = [req.user!.role];
    const { month, status, search } = req.query as { month?: string, status?: string, search?: string };
    const filters = { month, status, search };

    if (isHR(roles) || isAdmin(roles)) {
      // HR and Admin see every request in the system
      const requests = await repo.getAllRequests(filters);
      res.json({ requests });
    } else if (isManager(roles)) {
      // Managers see only the requests assigned to them as approver
      const requests = await repo.getManagerRequests(req.user!.entra_oid, filters);
      res.json({ requests });
    } else {
      throw forbidden("Only HR, Admin, or Manager roles can access this endpoint");
    }
  }
);

/**
 * GET /api/leave-requests/manager
 *
 * Returns leave requests where manager_oid = logged-in user's Entra OID.
 * Accessible by: Manager, HR, Admin.
 * Filtering is purely server-side; the frontend sends no filter params.
 */
router.get("/manager", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const roles = [req.user!.role];
    if (!canAccess(roles, isManager)) throw forbidden("Managers only");
    const requests = await repo.getManagerRequests(req.user!.entra_oid);
    res.json({ requests });
  }
);

router.get("/team", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const roles = [req.user!.role];
    if (!canAccess(roles, isManager)) throw forbidden("Managers only");
    const directReports = await getDirectReportOids(req.user!.entra_oid);
    const requests = await repo.getTeamRequests(directReports);
    res.json({ requests });
  }
);

// ─── Paid Leave Balance (accrual-based) ──────────────────────────────────────
router.get("/paid-balance", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const balance = await repo.getPaidLeaveBalance(req.user!.entra_oid, year);
    res.json({ balance, year });
  }
);

// ─── Leave Transactions ───────────────────────────────────────────────────────
router.get("/transactions", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const year   = req.query.year   ? parseInt(req.query.year as string)  : undefined;
    const type   = req.query.type   as string | undefined;
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const txs = await repo.getTransactions(req.user!.entra_oid, year, type, limit, offset);
    res.json({ transactions: txs });
  }
);

// ─── HR/Admin: get any employee's transactions ────────────────────────────────
router.get("/transactions/:employeeOid", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const year   = req.query.year ? parseInt(req.query.year as string) : undefined;
    const type   = req.query.type as string | undefined;
    const limit  = parseInt(req.query.limit  as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const txs = await repo.getTransactions(req.params.employeeOid, year, type, limit, offset);
    res.json({ transactions: txs });
  }
);

// ─── HR/Admin: manual leave balance adjustment ────────────────────────────────
const AdjustBalanceSchema = z.object({
  amount: z.number().refine(v => v !== 0, { message: "amount cannot be 0" }),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

router.post("/adjust/:employeeOid", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  validate(AdjustBalanceSchema),
  async (req: AuthRequest, res: Response) => {
    const { amount, reason } = req.body;
    const result = await repo.adjustBalance(
      req.params.employeeOid, amount, reason, req.user!.entra_oid
    );
    res.json({ success: true, newBalance: result.newBalance, year: result.year });
  }
);

// ─── Admin: manual cron triggers (for testing/recovery) ──────────────────────
router.post("/jobs/monthly-credit", requireAuth, requireRole([...ADMIN_ROLES]),
  async (_req: AuthRequest, res: Response) => {
    res.json({ message: "Monthly leave credit job triggered" });
    runMonthlyLeaveCredit().catch(console.error);
  }
);

router.post("/jobs/year-end-expiry", requireAuth, requireRole([...ADMIN_ROLES]),
  async (_req: AuthRequest, res: Response) => {
    res.json({ message: "Year-end expiry job triggered" });
    runYearEndLeaveExpiry().catch(console.error);
  }
);

const ALLOWED_CERT_MIMES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];

const CreateLeaveSchema = z.object({
  leaveType: z.enum(["annual", "sick", "casual", "unpaid", "other"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
  medicalCertificateName: z.string().max(255).optional(),
  medicalCertificateData: z.string().optional(),  // Base64 data URL
  medicalCertificateMime: z.string().optional(),
})
.refine(d => new Date(d.startDate) <= new Date(d.endDate), {
  message: "start_date must be on or before end_date",
})
.refine(d => !d.medicalCertificateData || d.leaveType === "sick", {
  message: "Medical certificate can only be attached to Sick Leave requests",
})
.refine(d => !d.medicalCertificateMime || ALLOWED_CERT_MIMES.includes(d.medicalCertificateMime), {
  message: "Only PDF, JPG, and PNG files are accepted",
});

router.post("/", requireAuth, validate(CreateLeaveSchema),
  async (req: AuthRequest, res: Response) => {
    const { leaveType, startDate, endDate, reason,
            medicalCertificateName, medicalCertificateData, medicalCertificateMime } = req.body;
    const user = req.user!;
    const roles = [user.role];

    if (isAdmin(roles)) {
      throw forbidden("Admin users cannot apply for leave");
    }

    const isHrOrManager = isHR(roles) || isManager(roles);

    if (!isHrOrManager && !user.manager_entra_oid)
      throw unprocessable("NO_MANAGER_ASSIGNED", "No manager assigned. Contact system admin.");

    const managerOid = user.manager_entra_oid || user.entra_oid;

    const totalDays = calcWorkingDays(startDate, endDate);
    const year = new Date(startDate).getFullYear();

    if (leaveType === "casual") {
      const hasBalance = await repo.hasSufficientPaidLeave(user.entra_oid, totalDays, year);
      if (!hasBalance)
        throw unprocessable("INSUFFICIENT_BALANCE", `Insufficient casual leave balance`);
    }

    let request = await repo.createRequest(
      user.entra_oid, managerOid, leaveType, startDate, endDate, totalDays, reason,
      medicalCertificateName, medicalCertificateData, medicalCertificateMime
    );

    if (isHrOrManager && !user.manager_entra_oid) {
      request = await repo.approveRequest(request.id, user.entra_oid, user.entra_oid, leaveType, totalDays, year);
      // ── Auto-approval: create OOO timesheet entries (fire-and-forget) ─────────
      createLeaveTimesheetEntries({
        employeeOid: user.entra_oid,
        leaveRequestId: request.id,
        startDate,
        endDate,
        leaveType,
      }).then(n => {
        console.log(`[LEAVE] Auto-approval: ${n} OOO timesheet entries created for ${user.entra_oid}`);
      }).catch(err => {
        console.error("[LEAVE] Failed to create OOO timesheet entries (auto-approval):", err);
      });
    }

    res.status(201).json({ request });

    // ── Notify HR users & Managers (fire-and-forget) ──────────────────────
    try {
      // Notify only the manager (we no longer store effective_role in the DB)
      const recipientOids = new Set<string>();
      if (managerOid && managerOid !== user.entra_oid) {
        recipientOids.add(managerOid);
      }

      // Ensure we don't notify the employee who is applying
      recipientOids.delete(user.entra_oid);

      const finalOids = Array.from(recipientOids);

      if (finalOids.length > 0) {
        const notifTitle = "New Leave Request";
        const notifMsg = `${user.name || "An employee"} has submitted a ${leaveType} leave request (${startDate} to ${endDate}).`;
        
        const notifications = await notifRepo.createNotifications(
          finalOids, "leave_request", notifTitle, notifMsg, "leave_request", request.id
        );
        notifications.forEach(n => emitNotification(n.recipient_oid, n));
        
        // Update unread counts
        const io = getSocketServer();
        if (io) {
          for (const oid of finalOids) {
            const count = await notifRepo.unreadCount(oid);
            io.to(`user:${oid}`).emit("unread_count", { count });
          }
        }
      }
    } catch (nErr) {
      console.error("[NOTIF] Failed to send leave request notification:", nErr);
    }
  }
);

const ActionSchema = z.object({
  action: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().optional(),
}).refine(d => d.action !== "rejected" || !!d.rejectionReason, {
  message: "rejectionReason is required when rejecting",
});

router.patch("/:id", requireAuth, validate(ActionSchema),
  async (req: AuthRequest, res: Response) => {
    const roles = [req.user!.role];
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
      // ── Manager/Admin approval: create OOO timesheet entries (fire-and-forget) ──
      const startStr = (leaveReq.start_date as unknown as string)?.toString().slice(0, 10);
      const endStr   = (leaveReq.end_date   as unknown as string)?.toString().slice(0, 10);
      createLeaveTimesheetEntries({
        employeeOid: leaveReq.employee_oid,
        leaveRequestId: req.params.id,
        startDate: startStr,
        endDate: endStr,
        leaveType: leaveReq.leave_type,
      }).then(n => {
        console.log(`[LEAVE] Approval: ${n} OOO timesheet entries created for ${leaveReq.employee_oid}`);
      }).catch(err => {
        console.error("[LEAVE] Failed to create OOO timesheet entries:", err);
      });
    } else {
      updated = await repo.rejectRequest(req.params.id, req.user!.entra_oid, req.body.rejectionReason!);
    }
    res.json({ request: updated });

    // ── Notify the employee about the decision ────────────────────────────
    try {
      const actionLabel = req.body.action === "approved" ? "approved" : "rejected";
      const notifTitle = `Leave Request ${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)}`;
      const startStr = (leaveReq.start_date as unknown as string)?.toString().slice(0, 10);
      const endStr = (leaveReq.end_date as unknown as string)?.toString().slice(0, 10);
      const notifMsg = req.body.action === "approved"
        ? `Your ${leaveReq.leave_type} leave request (${startStr} to ${endStr}) has been approved.`
        : `Your ${leaveReq.leave_type} leave request has been rejected. Reason: ${req.body.rejectionReason}`;
      const n = await notifRepo.createNotification(
        leaveReq.employee_oid, `leave_${actionLabel}`, notifTitle, notifMsg, "leave_request", req.params.id
      );
      emitNotification(leaveReq.employee_oid, n);
      const io = getSocketServer();
      if (io) {
        const count = await notifRepo.unreadCount(leaveReq.employee_oid);
        io.to(`user:${leaveReq.employee_oid}`).emit("unread_count", { count });
      }
    } catch (nErr) {
      console.error("[NOTIF] Failed to send leave decision notification:", nErr);
    }
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

// ─── HR/Admin: get any employee's paid leave balance ─────────────────────────
router.get("/paid-balance/:employeeOid", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const balance = await repo.getPaidLeaveBalance(req.params.employeeOid, year);
    res.json({ balance, year });
  }
);

export default router;
