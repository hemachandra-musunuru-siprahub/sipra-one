import { Router, Response, Request } from "express";
import { z } from "zod";
import { requireAuth, requireRole, AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { notFound, forbidden, conflict, badRequest } from "../../lib/errors";
import { isAdmin, isHR, ADMIN_ROLES, HR_ROLES, ALL_BUSINESS_ROLES } from "../../lib/roles";
import { query } from "../../db";
import { getSocketServer } from "../../lib/socketServer";
import * as XLSX from "xlsx";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── Auto-init table ─────────────────────────────────────────────────────────
(async () => {
  try {
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title            VARCHAR(255) NOT NULL,
        description      TEXT,
        holiday_type     VARCHAR(50) NOT NULL DEFAULT 'company',
        start_date       DATE NOT NULL,
        end_date         DATE NOT NULL,
        is_optional      BOOLEAN NOT NULL DEFAULT FALSE,
        is_recurring     BOOLEAN NOT NULL DEFAULT FALSE,
        status           VARCHAR(20) NOT NULL DEFAULT 'draft',
        organization_id  UUID,
        branch_id        UUID,
        department_id    UUID,
        location_id      UUID,
        notify_employees BOOLEAN NOT NULL DEFAULT TRUE,
        created_by       TEXT NOT NULL,
        updated_by       TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW(),
        updated_at       TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT chk_holiday_type   CHECK (holiday_type IN ('mandatory','optional','festival','regional','company')),
        CONSTRAINT chk_holiday_status CHECK (status IN ('draft','published','archived')),
        CONSTRAINT chk_holiday_dates  CHECK (end_date >= start_date)
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_holidays_status     ON holidays(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_holidays_start_date ON holidays(start_date)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_holidays_type       ON holidays(holiday_type)`);

    await query(`
      CREATE TABLE IF NOT EXISTS holiday_audit_logs (
        id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        holiday_id UUID NOT NULL REFERENCES holidays(id) ON DELETE CASCADE,
        action     VARCHAR(50) NOT NULL,
        changed_by TEXT NOT NULL,
        changes    JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.error("[HOLIDAYS SETUP ERROR]:", err);
  }
})();

// ─── Schemas ─────────────────────────────────────────────────────────────────
const HolidaySchema = z.object({
  title:           z.string().min(2).max(255),
  description:     z.string().optional().nullable(),
  holiday_type:    z.enum(["mandatory", "optional", "festival", "regional", "company"]),
  start_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  is_optional:     z.boolean().default(false),
  is_recurring:    z.boolean().default(false),
  status:          z.enum(["draft", "published", "archived"]).default("draft"),
  organization_id: z.string().uuid().optional().nullable(),
  branch_id:       z.string().uuid().optional().nullable(),
  department_id:   z.string().uuid().optional().nullable(),
  location_id:     z.string().uuid().optional().nullable(),
  notify_employees: z.boolean().default(true),
}).refine(d => new Date(d.start_date) <= new Date(d.end_date), {
  message: "end_date must be on or after start_date",
});

const StatusSchema = z.object({
  status: z.enum(["draft", "published", "archived"]),
});

// ─── Audit helper ─────────────────────────────────────────────────────────────
async function auditLog(holiday_id: string, action: string, changed_by: string, changes?: object) {
  await query(
    `INSERT INTO holiday_audit_logs (holiday_id, action, changed_by, changes) VALUES ($1, $2, $3, $4)`,
    [holiday_id, action, changed_by, changes ? JSON.stringify(changes) : null]
  );
}

// ─── Broadcast helper ─────────────────────────────────────────────────────────
function broadcastHolidayUpdate(event: string, payload: object) {
  const io = getSocketServer();
  if (io) io.emit(event, payload);
}

// ─── GET /api/holidays ────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req: AuthRequest, res: Response) => {
  const userRole = req.user!.role;
  const { year, status, holiday_type, search } = req.query as Record<string, string>;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  // Non-admin/HR roles can only see published holidays
  if (!isAdmin(userRole) && !isHR(userRole)) {
    conditions.push(`status = 'published'`);
  } else if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  if (year) {
    conditions.push(`EXTRACT(YEAR FROM start_date) = $${paramIdx++}`);
    params.push(parseInt(year));
  }

  if (holiday_type) {
    conditions.push(`holiday_type = $${paramIdx++}`);
    params.push(holiday_type);
  }

  if (search) {
    conditions.push(`title ILIKE $${paramIdx++}`);
    params.push(`%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT * FROM holidays ${where} ORDER BY start_date ASC, title ASC`,
    params
  );

  // Dashboard stats (admin/HR only)
  let stats = null;
  if (isAdmin(userRole) || isHR(userRole)) {
    const currentYear = year ? parseInt(year) : new Date().getFullYear();
    const statsRes = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'published') AS total_published,
        COUNT(*) FILTER (WHERE status = 'draft')     AS total_draft,
        COUNT(*) FILTER (WHERE status = 'archived')  AS total_archived,
        COUNT(*) FILTER (WHERE is_optional = true AND status = 'published') AS optional_count,
        COUNT(*) FILTER (WHERE start_date >= CURRENT_DATE AND status = 'published') AS upcoming_count
      FROM holidays
      WHERE EXTRACT(YEAR FROM start_date) = $1
    `, [currentYear]);
    stats = statsRes.rows[0];
  }

  res.json({ holidays: rows, stats });
});

// ─── GET /api/holidays/:id ────────────────────────────────────────────────────
router.get("/:id", requireAuth, async (req: AuthRequest, res: Response) => {
  const { rows } = await query(`SELECT * FROM holidays WHERE id = $1`, [req.params.id]);
  if (!rows[0]) throw notFound("Holiday not found");
  const holiday = rows[0];
  if (!isAdmin(req.user!.role) && !isHR(req.user!.role) && holiday.status !== "published") {
    throw forbidden("Holiday not available");
  }
  res.json({ holiday });
});

// ─── POST /api/holidays ───────────────────────────────────────────────────────
router.post("/", requireAuth, requireRole([...ADMIN_ROLES, ...HR_ROLES]),
  validate(HolidaySchema),
  async (req: AuthRequest, res: Response) => {
    const d = req.body;

    // Duplicate check: same title + overlapping dates
    const dupCheck = await query(
      `SELECT id FROM holidays WHERE LOWER(title) = LOWER($1) AND status != 'archived'
       AND start_date <= $3 AND end_date >= $2`,
      [d.title, d.start_date, d.end_date]
    );
    if (dupCheck.rows.length > 0) throw conflict("A holiday with the same name and overlapping dates already exists");

    const { rows } = await query(`
      INSERT INTO holidays (title, description, holiday_type, start_date, end_date,
        is_optional, is_recurring, status, organization_id, branch_id, department_id,
        location_id, notify_employees, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14)
      RETURNING *
    `, [d.title, d.description || null, d.holiday_type, d.start_date, d.end_date,
        d.is_optional, d.is_recurring, d.status,
        d.organization_id || null, d.branch_id || null, d.department_id || null,
        d.location_id || null, d.notify_employees, req.user!.entra_oid]);

    const holiday = rows[0];
    await auditLog(holiday.id, "created", req.user!.entra_oid, d);

    if (holiday.status === "published") {
      broadcastHolidayUpdate("holiday:updated", { action: "created", holiday });
    }

    res.status(201).json({ holiday });
  }
);

// ─── PUT /api/holidays/:id ────────────────────────────────────────────────────
router.put("/:id", requireAuth, requireRole([...ADMIN_ROLES, ...HR_ROLES]),
  validate(HolidaySchema),
  async (req: AuthRequest, res: Response) => {
    const { rows: existing } = await query(`SELECT * FROM holidays WHERE id = $1`, [req.params.id]);
    if (!existing[0]) throw notFound("Holiday not found");

    const d = req.body;

    // Duplicate check excluding current
    const dupCheck = await query(
      `SELECT id FROM holidays WHERE LOWER(title) = LOWER($1) AND status != 'archived'
       AND start_date <= $3 AND end_date >= $2 AND id != $4`,
      [d.title, d.start_date, d.end_date, req.params.id]
    );
    if (dupCheck.rows.length > 0) throw conflict("A holiday with the same name and overlapping dates already exists");

    const { rows } = await query(`
      UPDATE holidays SET
        title=$1, description=$2, holiday_type=$3, start_date=$4, end_date=$5,
        is_optional=$6, is_recurring=$7, status=$8, organization_id=$9,
        branch_id=$10, department_id=$11, location_id=$12, notify_employees=$13,
        updated_by=$14, updated_at=NOW()
      WHERE id=$15 RETURNING *
    `, [d.title, d.description || null, d.holiday_type, d.start_date, d.end_date,
        d.is_optional, d.is_recurring, d.status,
        d.organization_id || null, d.branch_id || null, d.department_id || null,
        d.location_id || null, d.notify_employees, req.user!.entra_oid, req.params.id]);

    const holiday = rows[0];
    await auditLog(holiday.id, "updated", req.user!.entra_oid, d);
    broadcastHolidayUpdate("holiday:updated", { action: "updated", holiday });

    res.json({ holiday });
  }
);

// ─── PATCH /api/holidays/:id/status ──────────────────────────────────────────
router.patch("/:id/status", requireAuth, requireRole([...ADMIN_ROLES, ...HR_ROLES]),
  validate(StatusSchema),
  async (req: AuthRequest, res: Response) => {
    const { rows: existing } = await query(`SELECT * FROM holidays WHERE id = $1`, [req.params.id]);
    if (!existing[0]) throw notFound("Holiday not found");

    const { rows } = await query(
      `UPDATE holidays SET status=$1, updated_by=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [req.body.status, req.user!.entra_oid, req.params.id]
    );
    const holiday = rows[0];
    await auditLog(holiday.id, `status_changed_to_${req.body.status}`, req.user!.entra_oid);
    broadcastHolidayUpdate("holiday:updated", { action: "status_changed", holiday });

    res.json({ holiday });
  }
);

// ─── POST /api/holidays/:id/duplicate ────────────────────────────────────────
router.post("/:id/duplicate", requireAuth, requireRole([...ADMIN_ROLES, ...HR_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const { rows: existing } = await query(`SELECT * FROM holidays WHERE id = $1`, [req.params.id]);
    if (!existing[0]) throw notFound("Holiday not found");
    const src = existing[0];

    const { rows } = await query(`
      INSERT INTO holidays (title, description, holiday_type, start_date, end_date,
        is_optional, is_recurring, status, organization_id, branch_id, department_id,
        location_id, notify_employees, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10,$11,$12,$13,$13)
      RETURNING *
    `, [`${src.title} (Copy)`, src.description, src.holiday_type, src.start_date,
        src.end_date, src.is_optional, src.is_recurring,
        src.organization_id, src.branch_id, src.department_id,
        src.location_id, src.notify_employees, req.user!.entra_oid]);

    const holiday = rows[0];
    await auditLog(holiday.id, "duplicated", req.user!.entra_oid, { source_id: req.params.id });
    res.status(201).json({ holiday });
  }
);

// ─── POST /api/holidays/bulk-publish ─────────────────────────────────────────
router.post("/bulk-publish", requireAuth, requireRole([...ADMIN_ROLES, ...HR_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw badRequest("ids array is required");
    const targetStatus = status || "published";
    if (!["published", "draft", "archived"].includes(targetStatus)) throw badRequest("Invalid status");

    await query(
      `UPDATE holidays SET status=$1, updated_by=$2, updated_at=NOW() WHERE id = ANY($3::uuid[])`,
      [targetStatus, req.user!.entra_oid, ids]
    );

    const { rows } = await query(`SELECT * FROM holidays WHERE id = ANY($1::uuid[])`, [ids]);
    broadcastHolidayUpdate("holiday:updated", { action: "bulk_status_changed", holidays: rows });
    res.json({ updated: rows.length, holidays: rows });
  }
);

// ─── DELETE /api/holidays/:id ─────────────────────────────────────────────────
router.delete("/:id", requireAuth, requireRole([...ADMIN_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const { rows: existing } = await query(`SELECT * FROM holidays WHERE id = $1`, [req.params.id]);
    if (!existing[0]) throw notFound("Holiday not found");

    await auditLog(req.params.id, "deleted", req.user!.entra_oid, { title: existing[0].title });
    await query(`DELETE FROM holidays WHERE id = $1`, [req.params.id]);

    broadcastHolidayUpdate("holiday:updated", { action: "deleted", id: req.params.id });
    res.status(204).send();
  }
);

// ─── GET /api/holidays/export ─────────────────────────────────────────────────
router.get("/export", requireAuth, requireRole([...ADMIN_ROLES, ...HR_ROLES]),
  async (req: AuthRequest, res: Response) => {
    const { format = "xlsx", year, status, holiday_type } = req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (year) { conditions.push(`EXTRACT(YEAR FROM start_date) = $${idx++}`); params.push(parseInt(year)); }
    if (status) { conditions.push(`status = $${idx++}`); params.push(status); }
    if (holiday_type) { conditions.push(`holiday_type = $${idx++}`); params.push(holiday_type); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await query(
      `SELECT title, description, holiday_type, start_date, end_date, is_optional, is_recurring, status, notify_employees, created_at
       FROM holidays ${where} ORDER BY start_date ASC`,
      params
    );

    const exportData = rows.map(r => ({
      "Holiday Name": r.title,
      "Description": r.description || "",
      "Type": r.holiday_type,
      "Start Date": r.start_date?.toString().slice(0, 10),
      "End Date": r.end_date?.toString().slice(0, 10),
      "Optional": r.is_optional ? "Yes" : "No",
      "Recurring": r.is_recurring ? "Yes" : "No",
      "Status": r.status,
      "Notify Employees": r.notify_employees ? "Yes" : "No",
      "Created At": r.created_at?.toString().slice(0, 10),
    }));

    if (format === "csv") {
      const headers = Object.keys(exportData[0] || {});
      const csv = [
        headers.join(","),
        ...exportData.map(row => headers.map(h => `"${(row as any)[h] || ""}"`).join(","))
      ].join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="holidays-${year || "all"}.csv"`);
      return res.send(csv);
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Holidays");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="holidays-${year || "all"}.xlsx"`);
    res.send(buf);
  }
);

// ─── POST /api/holidays/import ────────────────────────────────────────────────
router.post("/import", requireAuth, requireRole([...ADMIN_ROLES, ...HR_ROLES]),
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) throw badRequest("No file uploaded");

    const wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    if (!raw.length) throw badRequest("File is empty or has no data rows");

    const results: { row: number; status: "ok" | "error" | "duplicate"; data?: object; error?: string }[] = [];
    const inserted: object[] = [];
    const { publish } = req.body;

    for (let i = 0; i < raw.length; i++) {
      const r = raw[i];
      const rowNum = i + 2;

      const title = (r["Holiday Name"] || r["title"] || "").toString().trim();
      const startDate = r["Start Date"] || r["start_date"] || "";
      const endDate = r["End Date"] || r["end_date"] || startDate;
      const holiday_type = (r["Type"] || r["holiday_type"] || "company").toString().toLowerCase();
      const description = (r["Description"] || r["description"] || "").toString().trim();
      const is_optional = ["yes", "true", "1"].includes((r["Optional"] || "").toString().toLowerCase());
      const is_recurring = ["yes", "true", "1"].includes((r["Recurring"] || "").toString().toLowerCase());

      if (!title) { results.push({ row: rowNum, status: "error", error: "Missing Holiday Name" }); continue; }

      const startStr = typeof startDate === "object" ? (startDate as Date).toISOString().slice(0, 10) : startDate.toString().slice(0, 10);
      const endStr = typeof endDate === "object" ? (endDate as Date).toISOString().slice(0, 10) : endDate.toString().slice(0, 10);

      if (!startStr.match(/^\d{4}-\d{2}-\d{2}$/)) { results.push({ row: rowNum, status: "error", error: "Invalid Start Date format (use YYYY-MM-DD)" }); continue; }

      const validTypes = ["mandatory", "optional", "festival", "regional", "company"];
      const normalizedType = validTypes.includes(holiday_type) ? holiday_type : "company";

      // Duplicate check
      const dupCheck = await query(
        `SELECT id FROM holidays WHERE LOWER(title)=LOWER($1) AND status != 'archived' AND start_date <= $3 AND end_date >= $2`,
        [title, startStr, endStr]
      );
      if (dupCheck.rows.length > 0) { results.push({ row: rowNum, status: "duplicate", error: `Duplicate: "${title}" overlaps existing holiday` }); continue; }

      try {
        const targetStatus = publish === "true" || publish === true ? "published" : "draft";
        const { rows } = await query(`
          INSERT INTO holidays (title, description, holiday_type, start_date, end_date, is_optional, is_recurring, status, created_by, updated_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING *
        `, [title, description || null, normalizedType, startStr, endStr, is_optional, is_recurring, targetStatus, req.user!.entra_oid]);

        await auditLog(rows[0].id, "imported", req.user!.entra_oid);
        inserted.push(rows[0]);
        results.push({ row: rowNum, status: "ok", data: rows[0] });
      } catch (err: any) {
        results.push({ row: rowNum, status: "error", error: err.message });
      }
    }

    if (inserted.length > 0) broadcastHolidayUpdate("holiday:updated", { action: "bulk_import", count: inserted.length });

    res.json({
      total: raw.length,
      imported: inserted.length,
      errors: results.filter(r => r.status === "error").length,
      duplicates: results.filter(r => r.status === "duplicate").length,
      results,
      holidays: inserted,
    });
  }
);

export default router;
