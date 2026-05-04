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
// NOTE: This MUST be registered before GET /:id, or Express will capture "team"
// as the :id parameter and call getWeekWithEntries("team") → UUID parse error → 500.
router.get("/team", requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const roles = req.user!.roles || [];
      if (!canAccess(roles, isManager)) throw forbidden("Managers only");

      const employeeId = req.query.employeeId as string;
      const status     = (req.query.status as string)?.toLowerCase();
      const search     = (req.query.search  as string)?.trim() || undefined;

      const directReports = await getDirectReportOids(req.user!.entra_oid);

      let targetOids = directReports;
      if (employeeId && employeeId !== "all") {
        if (!directReports.includes(employeeId)) {
          throw forbidden("Employee is not in your team");
        }
        targetOids = [employeeId];
      }

      console.log("team timesheet query filters", { targetOids, status, search });
      const timesheets = await repo.getTeamTimesheets(targetOids, status, search);
      res.json({ timesheets });
    } catch (err: any) {
      // Re-throw HttpErrors (forbidden, etc.) so the global handler picks them up.
      // For unexpected errors log details and return 500.
      if (err.status) throw err;
      console.error("GET /api/timesheets/team failed:", err);
      res.status(500).json({ error: "Failed to load team timesheets", details: err.message });
    }
  }
);

// ─── GET /api/timesheets/manager-export — Manager Excel export ────────────────
// Allows Manager role; scoped to their direct reports; reviewed timesheets only.
// NOTE: Must remain before GET /:id (wildcard) to avoid route shadowing.
router.get("/manager-export", requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const roles = req.user!.roles || [];
      if (!canAccess(roles, isManager) && !canAccess(roles, isHR) && !canAccess(roles, isAdmin)) {
        throw forbidden("Managers, HR, or Admins only");
      }

      // ── Parse query params ────────────────────────────────────────────────
      const employeeId  = req.query.employeeId  as string | undefined;
      const monthParam  = req.query.month        as string | undefined; // YYYY-MM
      const month       = monthParam || new Date().toISOString().slice(0, 7);

      const [year, mon] = month.split("-").map(Number);
      const monthStart  = `${month}-01`;
      const lastDay     = new Date(year, mon, 0).getDate();  // last day of month
      const monthEnd    = `${month}-${String(lastDay).padStart(2, "0")}`;

      // ── Security: get manager's direct reports ────────────────────────────
      const directReports = await getDirectReportOids(req.user!.entra_oid);

      // If a specific employee is requested, verify they report to this manager
      let employeeOidFilter: string | undefined;
      if (employeeId && employeeId !== "all") {
        if (!canAccess(roles, isAdmin) && !directReports.includes(employeeId)) {
          throw forbidden("Employee is not in your team");
        }
        employeeOidFilter = employeeId;
      }

      const rows = await repo.getManagerExportData(directReports, monthStart, monthEnd, employeeOidFilter);

      // ── Build Excel workbook ──────────────────────────────────────────────
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator  = "SipraHub";
      workbook.created  = new Date();

      const sheet = workbook.addWorksheet("Reviewed Timesheets");

      // Header row
      sheet.columns = [
        { header: "Employee Name",    key: "employee_name",    width: 24 },
        { header: "Week Starting",    key: "week_start_date",  width: 14 },
        { header: "Date",             key: "work_date",        width: 12 },
        { header: "Project",          key: "project_name",     width: 24 },
        { header: "Task / Desc",      key: "task_description", width: 36 },
        { header: "Hours",            key: "entry_hours",      width: 8  },
        { header: "Total Week Hrs",   key: "total_hours",      width: 14 },
        { header: "Status",           key: "status",           width: 10 },
        { header: "Reviewed By",      key: "reviewed_by_name", width: 22 },
        { header: "Reviewed At",      key: "reviewed_at",      width: 22 },
        { header: "Manager Comments", key: "manager_comment",  width: 36 },
      ];

      // Style header row
      const headerRow = sheet.getRow(1);
      headerRow.font      = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCE2124" } };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height    = 20;

      const formatDate = (val: any): string => {
        if (!val) return "";
        const d = new Date(val);
        return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      };

      // Data rows
      rows.forEach((r: any) => {
        const row = sheet.addRow({
          employee_name:    r.employee_name,
          week_start_date:  formatDate(r.week_start_date),
          work_date:        formatDate(r.work_date),
          project_name:     r.project_name   || "",
          task_description: r.task_description || "",
          entry_hours:      r.entry_hours     != null ? Number(r.entry_hours)   : "",
          total_hours:      r.total_hours     != null ? Number(r.total_hours)   : "",
          status:           r.status,
          reviewed_by_name: r.reviewed_by_name || "",
          reviewed_at:      formatDate(r.reviewed_at),
          manager_comment:  r.manager_comment  || "",
        });
        // Zebra stripe
        if (row.number % 2 === 0) {
          row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
        }
      });

      // Auto-filter on header row
      sheet.autoFilter = { from: "A1", to: "K1" };

      // ── Send response ─────────────────────────────────────────────────────
      const empLabel    = employeeOidFilter
        ? (rows[0]?.employee_name || "employee").replace(/\s+/g, "-")
        : "all-employees";
      const filename    = `${empLabel}-reviewed-timesheets-${month}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-cache");

      await workbook.xlsx.write(res);
      res.end();
    } catch (err: any) {
      if (err.status) throw err;
      console.error("GET /api/timesheets/manager-export failed:", err);
      res.status(500).json({ error: "Export failed", details: err.message });
    }
  }
);

// ─── GET /api/timesheets/export — CSV export (HR/Admin only) ─────────────────
router.get("/export", requireAuth, requireRole([...HR_ROLES, ...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const startDate = (req.query.startDate as string) || "2020-01-01";
    const endDate   = (req.query.endDate   as string) || new Date().toISOString().slice(0, 10);
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

// ─── GET /api/timesheets/:id — specific timesheet detail ──────────────────────
// IMPORTANT: Wildcard route — must be LAST among GET routes.
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const ts = await repo.getWeekWithEntries(req.params.id);
  if (!ts) throw notFound("Timesheet not found");

  const roles = req.user!.roles || [];
  const isOwner    = ts.employee_oid === req.user!.entra_oid;
  const isHrOrAdmin = canAccess(roles, isHR) || canAccess(roles, isAdmin);

  if (!isOwner && !isHrOrAdmin) {
    if (canAccess(roles, isManager)) {
      const reports = await getDirectReportOids(req.user!.entra_oid);
      if (!reports.includes(ts.employee_oid)) {
        throw forbidden("Access denied");
      }
    } else {
      throw forbidden("Access denied");
    }
  }

  res.json({ timesheet: ts });
});

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

// ─── PUT /api/timesheets/entries/:entryId — update entry (new format) ──────────
const PutEntrySchema = z.object({
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  project: z.string().min(1).max(100),
  task:    z.string().min(1),
  hours:   z.number().min(0.5).max(24).multipleOf(0.5),
});

router.put("/entries/:entryId", requireAuth, validate(PutEntrySchema),
  async (req: AuthRequest, res: Response) => {
    const entry = await repo.getEntryWithTimesheet(req.params.entryId);
    if (!entry) throw notFound("Entry not found");

    if (entry.employee_oid !== req.user!.entra_oid && !isAdmin(req.user!.roles || []))
      throw forbidden("You can only edit your own entries");

    if (entry.status !== "draft")
      throw forbidden("Only entries in draft timesheets can be edited");

    const { date, project, task, hours } = req.body;
    const updated = await repo.updateEntry(req.params.entryId, entry.timesheet_week_id, {
      work_date: date,
      project_name: project,
      task_description: task,
      hours
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
  status:         z.enum(["reviewed", "draft"]),
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
