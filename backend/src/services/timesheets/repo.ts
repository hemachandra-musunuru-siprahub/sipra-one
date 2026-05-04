import { query, pool } from "../../db";

// ─── Get or create a draft week ───────────────────────────────────────────────
export const getOrCreateWeek = async (employeeOid: string, weekStartDate: string) => {
  // Try to find existing
  const existing = await query(
    `SELECT tw.*, COALESCE(json_agg(te ORDER BY te.work_date) FILTER (WHERE te.id IS NOT NULL), '[]') AS entries
     FROM timesheet_weeks tw
     LEFT JOIN timesheet_entries te ON te.timesheet_week_id = tw.id
     WHERE tw.employee_oid = $1 AND tw.week_start_date = $2
     GROUP BY tw.id`,
    [employeeOid, weekStartDate]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  // Create new draft
  const created = await query(
    `INSERT INTO timesheet_weeks (employee_oid, week_start_date, status, total_hours)
     VALUES ($1, $2, 'draft', 0) RETURNING *`,
    [employeeOid, weekStartDate]
  );
  return { ...created.rows[0], entries: [] };
};

// ─── Get week with entries ────────────────────────────────────────────────────
export const getWeekWithEntries = async (timesheetId: string) => {
  const { rows } = await query(
    `SELECT tw.*, COALESCE(json_agg(te ORDER BY te.work_date) FILTER (WHERE te.id IS NOT NULL), '[]') AS entries
     FROM timesheet_weeks tw
     LEFT JOIN timesheet_entries te ON te.timesheet_week_id = tw.id
     WHERE tw.id = $1 GROUP BY tw.id`,
    [timesheetId]
  );
  return rows[0] || null;
};

// ─── Get entry with timesheet status ──────────────────────────────────────────
export const getEntryWithTimesheet = async (entryId: string) => {
  const { rows } = await query(
    `SELECT te.*, tw.employee_oid, tw.status
     FROM timesheet_entries te
     JOIN timesheet_weeks tw ON tw.id = te.timesheet_week_id
     WHERE te.id = $1`,
    [entryId]
  );
  return rows[0] || null;
};

// ─── Add entry ────────────────────────────────────────────────────────────────
export const addEntry = async (
  timesheetId: string, workDate: string, projectName: string,
  taskDescription: string, hours: number
) => {
  await query(
    `INSERT INTO timesheet_entries (timesheet_week_id, work_date, project_name, task_description, hours)
     VALUES ($1, $2, $3, $4, $5)`,
    [timesheetId, workDate, projectName, taskDescription, hours]
  );
  // Update total hours
  await query(
    `UPDATE timesheet_weeks SET total_hours = (
       SELECT COALESCE(SUM(hours),0) FROM timesheet_entries WHERE timesheet_week_id = $1
     ), updated_at = NOW() WHERE id = $1`,
    [timesheetId]
  );
  return getWeekWithEntries(timesheetId);
};

// ─── Update entry ─────────────────────────────────────────────────────────────
export const updateEntry = async (
  entryId: string, timesheetId: string,
  fields: { work_date?: string; project_name?: string; task_description?: string; hours?: number }
) => {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (fields.work_date)        { sets.push(`work_date = $${i++}`);        vals.push(fields.work_date); }
  if (fields.project_name)     { sets.push(`project_name = $${i++}`);     vals.push(fields.project_name); }
  if (fields.task_description) { sets.push(`task_description = $${i++}`); vals.push(fields.task_description); }
  if (fields.hours !== undefined) { sets.push(`hours = $${i++}`); vals.push(fields.hours); }
  sets.push(`updated_at = NOW()`);
  vals.push(entryId);
  await query(`UPDATE timesheet_entries SET ${sets.join(", ")} WHERE id = $${i}`, vals);
  // Recalculate total
  await query(
    `UPDATE timesheet_weeks SET total_hours = (
       SELECT COALESCE(SUM(hours),0) FROM timesheet_entries WHERE timesheet_week_id = $1
     ), updated_at = NOW() WHERE id = $1`,
    [timesheetId]
  );
  return getWeekWithEntries(timesheetId);
};

// ─── Delete entry ─────────────────────────────────────────────────────────────
export const deleteEntry = async (entryId: string, timesheetId: string) => {
  await query(`DELETE FROM timesheet_entries WHERE id = $1`, [entryId]);
  await query(
    `UPDATE timesheet_weeks SET total_hours = (
       SELECT COALESCE(SUM(hours),0) FROM timesheet_entries WHERE timesheet_week_id = $1
     ), updated_at = NOW() WHERE id = $1`,
    [timesheetId]
  );
  return getWeekWithEntries(timesheetId);
};

// ─── Submit timesheet ─────────────────────────────────────────────────────────
export const submitTimesheet = async (timesheetId: string) => {
  const { rows } = await query(
    `UPDATE timesheet_weeks SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [timesheetId]
  );
  return rows[0];
};

// ─── Update status (manager) ──────────────────────────────────────────────────
export const updateStatus = async (timesheetId: string, status: "draft" | "reviewed", managerOid: string, comment?: string) => {
  const { rows } = await query(
    `UPDATE timesheet_weeks
     SET status = $2, reviewed_by_oid = $3, reviewed_at = NOW(), manager_comment = $4, updated_at = NOW()
     WHERE id = $1 RETURNING *`,
    [timesheetId, status, managerOid, comment || null]
  );
  return rows[0];
};

export const getTeamTimesheets = async (
  directReportOids: string[],
  status?: string,
  search?: string         // optional name/email ILIKE search
) => {
  if (directReportOids.length === 0) return [];

  const params: any[] = [directReportOids];
  let paramIdx = 2; // $1 is already directReportOids

  let queryStr = `
    SELECT tw.*, u.name AS employee_name, u.email AS employee_email,
       COALESCE(json_agg(te ORDER BY te.work_date) FILTER (WHERE te.id IS NOT NULL), '[]') AS entries
    FROM timesheet_weeks tw
    LEFT JOIN users u ON u.entra_oid = tw.employee_oid
    LEFT JOIN timesheet_entries te ON te.timesheet_week_id = tw.id
    WHERE tw.employee_oid = ANY($1)
  `;

  if (status && status !== "all") {
    queryStr += ` AND tw.status = $${paramIdx++}`;
    params.push(status.toLowerCase());
  }

  if (search && search.trim()) {
    queryStr += ` AND (u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`;
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  queryStr += `
    GROUP BY tw.id, u.name, u.email
    ORDER BY tw.week_start_date DESC
  `;

  const { rows } = await query(queryStr, params);
  return rows;
};


// ─── Export data (hr_admin) ───────────────────────────────────────────────────
export const getExportData = async (startDate: string, endDate: string) => {
  const { rows } = await query(
    `SELECT u.name, u.email, tw.week_start_date, tw.total_hours, tw.status,
            te.work_date, te.project_name, te.task_description, te.hours
     FROM timesheet_weeks tw
     JOIN users u ON u.entra_oid = tw.employee_oid
     LEFT JOIN timesheet_entries te ON te.timesheet_week_id = tw.id
     WHERE tw.status = 'reviewed' AND tw.week_start_date BETWEEN $1 AND $2
     ORDER BY u.name, tw.week_start_date, te.work_date`,
    [startDate, endDate]
  );
  return rows;
};

// ─── Manager export data (reviewed only, scoped to direct reports) ─────────────
export const getManagerExportData = async (
  directReportOids: string[],
  monthStart: string,   // YYYY-MM-DD (first day of month)
  monthEnd: string,     // YYYY-MM-DD (last day of month)
  employeeOid?: string  // optional single-employee filter
) => {
  const targetOids = employeeOid ? [employeeOid] : directReportOids;

  // Safety: if manager has no direct reports and no specific employee is requested, return []
  if (targetOids.length === 0) {
    console.warn("getManagerExportData: targetOids is empty — no direct reports found for this manager");
    return [];
  }

  // Widen date range by 7 days on each side so weeks that straddle month boundaries
  // (e.g. a week STARTING in late March that contains April entries) are included.
  // We still filter by status='reviewed' so only completed data is exported.
  const startDt = new Date(monthStart);
  startDt.setUTCDate(startDt.getUTCDate() - 7);
  const endDt = new Date(monthEnd);
  endDt.setUTCDate(endDt.getUTCDate() + 7);
  const rangeStart = startDt.toISOString().slice(0, 10);
  const rangeEnd   = endDt.toISOString().slice(0, 10);

  console.log("Export filters:", {
    targetOids,
    requestedMonth:  `${monthStart} → ${monthEnd}`,
    queryRange:      `${rangeStart} → ${rangeEnd}`,
    employeeFilter:  employeeOid || "all direct reports",
  });

  // ── Run a quick sanity check — how many reviewed rows exist for these OIDs? ──
  const sanity = await query(
    `SELECT COUNT(*) AS cnt FROM timesheet_weeks
     WHERE employee_oid = ANY($1) AND status = 'reviewed'`,
    [targetOids]
  );
  console.log("Sanity check — total reviewed timesheets for targetOids:", sanity.rows[0]?.cnt);

  const { rows } = await query(
    // IMPORTANT: Use LEFT JOIN on users so timesheets are not silently dropped
    // if the reviewer or employee is missing from the users cache table.
    `SELECT
       u.name               AS employee_name,
       u.email              AS employee_email,
       tw.id                AS timesheet_id,
       tw.week_start_date,
       tw.total_hours,
       tw.status,
       tw.reviewed_at,
       tw.manager_comment,
       rev.name             AS reviewed_by_name,
       te.work_date,
       te.project_name,
       te.task_description,
       te.hours             AS entry_hours
     FROM timesheet_weeks tw
     LEFT JOIN users u     ON u.entra_oid = tw.employee_oid
     LEFT JOIN users rev   ON rev.entra_oid = tw.reviewed_by_oid
     LEFT JOIN timesheet_entries te ON te.timesheet_week_id = tw.id
     WHERE tw.employee_oid = ANY($1)
       AND tw.status = 'reviewed'
       AND tw.week_start_date >= $2
       AND tw.week_start_date <= $3
     ORDER BY u.name, tw.week_start_date, te.work_date`,
    [targetOids, rangeStart, rangeEnd]
  );

  console.log("Export rows count:", rows.length);
  if (rows.length === 0) {
    console.warn(
      "Export returned 0 rows. " +
      "Check: (1) timesheets have status='reviewed', " +
      "(2) week_start_date falls within range, " +
      "(3) employee_oid matches users.manager_entra_oid."
    );
  }

  return rows;
};

