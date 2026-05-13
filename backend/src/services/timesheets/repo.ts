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
  await query(
    `UPDATE timesheet_weeks SET status = 'submitted', submitted_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [timesheetId]
  );
  return getWeekWithEntries(timesheetId);
};

// ─── Update status (manager) ──────────────────────────────────────────────────
export const updateStatus = async (timesheetId: string, status: "draft" | "reviewed" | "rejected", managerOid: string, comment?: string) => {
  await query(
    `UPDATE timesheet_weeks
     SET status = $2, reviewed_by_oid = $3, reviewed_at = NOW(), manager_comment = $4, updated_at = NOW()
     WHERE id = $1`,
    [timesheetId, status, managerOid, comment || null]
  );
  return getWeekWithEntries(timesheetId);
};

export const getTeamTimesheets = async (
  directReportOids: string[],
  status?: string,
  search?: string,         // optional name/email ILIKE search
  month?: string           // optional YYYY-MM
) => {
  if (directReportOids.length === 0) return [];

  const params: any[] = [directReportOids];
  let paramIdx = 2; // $1 is already directReportOids

  let queryStr = `
    SELECT tw.id, tw.employee_oid, tw.week_start_date, tw.status, tw.submitted_at, tw.reviewed_at, tw.reviewed_by_oid, tw.manager_comment,
       u.name AS employee_name, u.email AS employee_email,
       (SELECT COALESCE(SUM(hours), 0) FROM timesheet_entries WHERE timesheet_week_id = tw.id) AS total_hours,
       (SELECT COUNT(*) FROM timesheet_entries WHERE timesheet_week_id = tw.id) AS entries_count,
       COALESCE(json_agg(te ORDER BY te.work_date) FILTER (WHERE te.id IS NOT NULL), '[]') AS entries
    FROM timesheet_weeks tw
    LEFT JOIN users u ON u.entra_oid = tw.employee_oid
    LEFT JOIN timesheet_entries te ON te.timesheet_week_id = tw.id
    WHERE tw.employee_oid = ANY($1)
      AND tw.status != 'draft'
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

  if (month) {
    const [year, mon] = month.split("-").map(Number);
    const startDate = `${month}-01`;
    const endDate   = mon === 12 
      ? `${year + 1}-01-01` 
      : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
    
    console.log(`[REPO] Filtering team timesheets by month: ${month} (${startDate} to ${endDate})`);
    
    queryStr += ` AND tw.week_start_date >= $${paramIdx++} AND tw.week_start_date < $${paramIdx++}`;
    params.push(startDate, endDate);
  }

  queryStr += `
    GROUP BY tw.id, u.name, u.email
    HAVING (SELECT COALESCE(SUM(hours), 0) FROM timesheet_entries WHERE timesheet_week_id = tw.id) > 0
    ORDER BY tw.week_start_date DESC
  `;

  const { rows } = await query(queryStr, params);
  return rows;
};


// ─── HR export data (all employees, with filters) ─────────────────────────────
export const getHRExportData = async (options?: {
  employeeOid?: string;
  status?: string;
  month?: string;
}) => {
  const params: any[] = [];
  let paramIdx = 1;
  const conditions: string[] = [`tw.status IN ('submitted', 'reviewed', 'rejected')`];

  if (options?.employeeOid && options.employeeOid !== "all") {
    conditions.push(`tw.employee_oid = $${paramIdx++}`);
    params.push(options.employeeOid);
  }

  if (options?.status && options.status !== "all" && options.status !== "draft") {
    conditions.push(`tw.status = $${paramIdx++}`);
    params.push(options.status.toLowerCase());
  }

  if (options?.month) {
    const startOfMonth = `${options.month}-01`;
    const endOfMonth   = `(date '${startOfMonth}' + interval '1 month' - interval '1 day')`;
    conditions.push(`tw.week_start_date <= ${endOfMonth}`);
    conditions.push(`(tw.week_start_date + interval '6 days') >= date '${startOfMonth}'`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const { rows } = await query(
    `SELECT
       u.name               AS employee_name,
       u.email              AS employee_email,
       tw.id                AS timesheet_id,
       tw.week_start_date,
       (SELECT COALESCE(SUM(hours), 0) FROM timesheet_entries WHERE timesheet_week_id = tw.id) AS total_hours,
       tw.status,
       tw.submitted_at,
       tw.reviewed_at,
       tw.manager_comment,
       rev.name             AS reviewed_by_name,
       te.work_date,
       te.project_name,
       te.task_description,
       te.hours             AS entry_hours
     FROM timesheet_weeks tw
     LEFT JOIN users u      ON u.entra_oid = tw.employee_oid
     LEFT JOIN users rev    ON rev.entra_oid = tw.reviewed_by_oid
     LEFT JOIN timesheet_entries te ON te.timesheet_week_id = tw.id
     ${where}
     ORDER BY u.name, tw.week_start_date, te.work_date`,
    params
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
       (SELECT COALESCE(SUM(hours), 0) FROM timesheet_entries WHERE timesheet_week_id = tw.id) AS total_hours,
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

// ─── Employee history: all own timesheets (no entries, lightweight) ───────────
export const getMyHistory = async (
  employeeOid: string,
  options?: { status?: string; month?: string }
) => {
  const params: any[] = [employeeOid];
  let paramIdx = 2;
  const conditions: string[] = [`tw.employee_oid = $1`];

  if (options?.status && options.status !== "all") {
    conditions.push(`tw.status = $${paramIdx++}`);
    params.push(options.status.toLowerCase());
  }

  if (options?.month) {
    conditions.push(`to_char(tw.week_start_date, 'YYYY-MM') = $${paramIdx++}`);
    params.push(options.month);
  }

  const { rows } = await query(
    `SELECT
       tw.id,
       tw.week_start_date,
       (SELECT COALESCE(SUM(hours), 0) FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id) AS total_hours,
       tw.status,
       tw.submitted_at,
       tw.reviewed_at,
       tw.manager_comment,
       (SELECT COUNT(*) FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id) AS entries_count
     FROM timesheet_weeks tw
     WHERE ${conditions.join(" AND ")}
     ORDER BY tw.week_start_date DESC`,
    params
  );
  return rows;
};

// ─── HR view: all timesheets across all employees ─────────────────────────────
export const getHRTimesheets = async (options?: {
  employeeOid?: string;
  status?: string;
  month?: string;   // YYYY-MM  → filters by week_start_date
}) => {
  const params: any[] = [];
  let paramIdx = 1;
  // ── SECURITY: HR must never see draft records — always enforced server-side.
  const conditions: string[] = [`tw.status IN ('submitted', 'reviewed', 'rejected')`];

  if (options?.employeeOid) {
    conditions.push(`tw.employee_oid = $${paramIdx++}`);
    params.push(options.employeeOid);
  }

  // Only allow narrowing to valid statuses — 'draft' is silently rejected.
  if (options?.status && options.status !== "all" && options.status !== "draft") {
    conditions.push(`tw.status = $${paramIdx++}`);
    params.push(options.status.toLowerCase());
  }

  if (options?.month) {
    // Overlap logic: week must start on or before end of month AND end on or after start of month.
    // options.month is 'YYYY-MM'
    const startOfMonth = `${options.month}-01`;
    const endOfMonth   = `(date '${startOfMonth}' + interval '1 month' - interval '1 day')`;
    
    conditions.push(`tw.week_start_date <= ${endOfMonth}`);
    conditions.push(`(tw.week_start_date + interval '6 days') >= date '${startOfMonth}'`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`; // always at least one condition

  const { rows } = await query(
    `SELECT
       tw.id,
       tw.employee_oid,
       u.name        AS employee_name,
       u.email       AS employee_email,
       tw.week_start_date,
       (SELECT COALESCE(SUM(hours), 0) FROM timesheet_entries WHERE timesheet_week_id = tw.id) AS total_hours,
       (SELECT COUNT(*) FROM timesheet_entries WHERE timesheet_week_id = tw.id) AS entries_count,
       tw.status,
       tw.submitted_at,
       tw.reviewed_at
     FROM timesheet_weeks tw
     LEFT JOIN users u ON u.entra_oid = tw.employee_oid
     ${where}
     GROUP BY tw.id, u.name, u.email
     HAVING (SELECT COALESCE(SUM(hours), 0) FROM timesheet_entries WHERE timesheet_week_id = tw.id) > 0
     ORDER BY tw.week_start_date DESC, u.name ASC`,
    params
  );
  return rows;
};
