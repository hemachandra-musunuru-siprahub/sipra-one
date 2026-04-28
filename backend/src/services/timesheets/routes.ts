import { Router, Response } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, forbidden, badRequest, conflict, unprocessable } from "../../lib/errors";
import { isAdmin, isManager, isHR, HR_ROLES, MANAGER_ROLES, ADMIN_ROLES, canAccess } from "../../lib/roles";
import * as repo from "./repo";
import { getDirectReportOids } from "../users/repo";

const router = Router();

// ─── Normalize week to Monday ─────────────────────────────────────────────────
const normalizeToMonday = (dateStr: string): string => {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = 1
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};

// ─── GET /api/timesheets?week=YYYY-MM-DD — own week ───────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const rawWeek = (req.query.week as string) || new Date().toISOString().slice(0, 10);
  const weekStart = normalizeToMonday(rawWeek);
  const timesheet = await repo.getOrCreateWeek(req.user!.entra_oid, weekStart);
  res.json({ timesheet });
});

// ─── GET /api/timesheets/team — manager view ──────────────────────────────────
router.get("/team", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const roles = req.user!.roles || [];
    if (!canAccess(roles, isManager)) throw forbidden("Managers only");
    const directReports = await getDirectReportOids(req.user!.entra_oid);
    const timesheets = await repo.getTeamTimesheets(directReports);
    res.json({ timesheets });
  }
);

// ─── GET /api/timesheets/export — CSV (hr_admin only) ─────────────────────────
router.get("/export", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const startDate = (req.query.startDate as string) || "2020-01-01";
    const endDate   = (req.query.endDate as string)   || new Date().toISOString().slice(0, 10);
    const rows = await repo.getExportData(startDate, endDate);

    if (rows.length === 0) {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=timesheets.csv");
      return res.send("name,email,week_start_date,work_date,project_name,task_description,hours,status\n");
    }

    const csv = [
      "name,email,week_start_date,work_date,project_name,task_description,hours,status",
      ...rows.map((r: any) =>
        [r.name, r.email, r.week_start_date, r.work_date, r.project_name, r.task_description, r.hours, r.status]
          .map(v => `"${v ?? ""}"`)
          .join(",")
      ),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=timesheets.csv");
    res.send(csv);
  }
);

// ─── POST /api/timesheets/:id/entries — add entry (employee, draft only) ──────
const EntrySchema = z.object({
  workDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  projectName:     z.string().min(1).max(100),
  taskDescription: z.string().min(1),
  hours:           z.number().min(0.5).max(24).multipleOf(0.5),
});

router.post("/:id/entries", requireAuth, validate(EntrySchema),
  async (req: AuthRequest, res: Response) => {
    const ts = await repo.getWeekWithEntries(req.params.id);
    if (!ts) throw notFound("Timesheet not found");
    if (ts.employee_oid !== req.user!.entra_oid && !isAdmin(req.user!.roles || []))
      throw forbidden("You can only edit your own timesheet");
    if (ts.status !== "draft") throw forbidden("Only draft timesheets can be edited");

    const { workDate, projectName, taskDescription, hours } = req.body;
    const updated = await repo.addEntry(req.params.id, workDate, projectName, taskDescription, hours);
    res.status(201).json({ timesheet: updated });
  }
);

// ─── PATCH /api/timesheets/:id/entries/:entryId — update entry ────────────────
const UpdateEntrySchema = z.object({
  workDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  projectName:     z.string().min(1).max(100).optional(),
  taskDescription: z.string().min(1).optional(),
  hours:           z.number().min(0.5).max(24).multipleOf(0.5).optional(),
});

router.patch("/:id/entries/:entryId", requireAuth, validate(UpdateEntrySchema),
  async (req: AuthRequest, res: Response) => {
    const ts = await repo.getWeekWithEntries(req.params.id);
    if (!ts) throw notFound("Timesheet not found");
    if (ts.employee_oid !== req.user!.entra_oid && !isAdmin(req.user!.roles || []))
      throw forbidden("You can only edit your own timesheet");
    if (ts.status !== "draft") throw forbidden("Only draft timesheets can be edited");

    const { workDate, projectName, taskDescription, hours } = req.body;
    const updated = await repo.updateEntry(req.params.entryId, req.params.id, {
      work_date: workDate, project_name: projectName, task_description: taskDescription, hours
    });
    res.json({ timesheet: updated });
  }
);

// ─── DELETE /api/timesheets/:id/entries/:entryId — delete entry ───────────────
router.delete("/:id/entries/:entryId", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const ts = await repo.getWeekWithEntries(req.params.id);
    if (!ts) throw notFound("Timesheet not found");
    if (ts.employee_oid !== req.user!.entra_oid && !isAdmin(req.user!.roles || []))
      throw forbidden("You can only edit your own timesheet");
    if (ts.status !== "draft") throw forbidden("Only draft timesheets can be edited");

    const updated = await repo.deleteEntry(req.params.entryId, req.params.id);
    res.json({ timesheet: updated });
  }
);

// ─── POST /api/timesheets/:id/submit ──────────────────────────────────────────
router.post("/:id/submit", requireAuth,
  async (req: AuthRequest, res: Response) => {
    const ts = await repo.getWeekWithEntries(req.params.id);
    if (!ts) throw notFound("Timesheet not found");
    if (ts.employee_oid !== req.user!.entra_oid) throw forbidden("You can only submit your own timesheet");
    if (ts.status !== "draft") throw conflict("Timesheet is already submitted");
    if (!ts.entries || ts.entries.length === 0) throw badRequest("Cannot submit an empty timesheet");

    const updated = await repo.submitTimesheet(req.params.id);
    res.json({ timesheet: updated });
  }
);

// ─── PATCH /api/timesheets/:id/status — manager review/reject ────────────────
const UpdateStatusSchema = z.object({
  status:        z.enum(["reviewed", "draft"]),
  managerComment: z.string().optional(),
});

router.patch("/:id/status", requireAuth, validate(UpdateStatusSchema),
  async (req: AuthRequest, res: Response) => {
    const roles = req.user!.roles || [];
    if (!canAccess(roles, isManager)) throw forbidden("Managers only");

    const ts = await repo.getWeekWithEntries(req.params.id);
    if (!ts) throw notFound("Timesheet not found");
    if (ts.status !== "submitted") throw unprocessable("INVALID_STATUS", "Can only review submitted timesheets");

    // Check manager owns this direct report
    if (!isAdmin(roles)) {
      const reports = await getDirectReportOids(req.user!.entra_oid);
      if (!reports.includes(ts.employee_oid)) throw forbidden("You can only review your direct reports");
    }

    const updated = await repo.updateStatus(req.params.id, req.body.status, req.user!.entra_oid, req.body.managerComment);
    res.json({ timesheet: updated });
  }
);

export default router;
