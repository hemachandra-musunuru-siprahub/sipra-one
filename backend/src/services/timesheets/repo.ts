import { query, pool } from "../../db";

// ─── Helper: calculate Monday of the week for a given date ───────────────────
const getMondayForDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};

// ─── Ensure holidays are generated for a draft week ───────────────────────────
export const ensureHolidaysForWeek = async (timesheetId: string, weekStartDate: string) => {
  const start = new Date(weekStartDate);
  const end = new Date(weekStartDate);
  end.setUTCDate(end.getUTCDate() + 6);
  const endStr = end.toISOString().slice(0, 10);
  
  const holidays = await query(
    `SELECT id, title, start_date, end_date FROM holidays
     WHERE status = 'published'
       AND start_date <= $2 AND end_date >= $1`,
    [weekStartDate, endStr]
  );
  
  if (holidays.rows.length === 0) return;
  
  let changed = false;
  
  for (const h of holidays.rows) {
    const hStart = new Date(h.start_date);
    const hEnd = new Date(h.end_date);
    
    const overlapStart = hStart > start ? hStart : start;
    const overlapEnd = hEnd < end ? hEnd : end;
    
    let current = new Date(overlapStart);
    while (current <= overlapEnd) {
       const dayOfWeek = current.getUTCDay();
       if (dayOfWeek !== 0 && dayOfWeek !== 6) {
           const workDateStr = current.toISOString().slice(0, 10);
           
           const existing = await query(`
             SELECT id, holiday_id, leave_request_id FROM timesheet_entries
             WHERE timesheet_week_id = $1 AND work_date = $2 AND is_system_generated = true
           `, [timesheetId, workDateStr]);
           
           if (existing.rows.length > 0) {
              const ext = existing.rows[0];
              if (ext.holiday_id !== h.id) {
                 await query(`
                   UPDATE timesheet_entries 
                   SET project_name = 'Holiday', task_description = $1, holiday_id = $2, leave_request_id = NULL
                   WHERE id = $3
                 `, [h.title, h.id, ext.id]);
                 changed = true;
              }
           } else {
              await query(`
                 INSERT INTO timesheet_entries
                   (timesheet_week_id, work_date, project_name, task_description, hours, is_system_generated, holiday_id)
                 VALUES ($1, $2, 'Holiday', $3, 8, true, $4)
              `, [timesheetId, workDateStr, h.title, h.id]);
              changed = true;
           }
       }
       current.setUTCDate(current.getUTCDate() + 1);
    }
  }
  
  if (changed) {
    await query(
      `UPDATE timesheet_weeks SET total_hours = (
         SELECT COALESCE(SUM(hours),0) FROM timesheet_entries WHERE timesheet_week_id = $1
       ), updated_at = NOW() WHERE id = $1`,
      [timesheetId]
    );
  }
};

// ─── Get or create a draft week ───────────────────────────────────────────────
export const getOrCreateWeek = async (employeeOid: string, weekStartDate: string) => {
  // Try to find existing
  let weekId: string;
  let status: string;
  
  const existing = await query(
    `SELECT id, status
     FROM timesheet_weeks tw
     WHERE tw.employee_oid = $1 AND tw.week_start_date = $2`,
    [employeeOid, weekStartDate]
  );
  
  if (existing.rows.length > 0) {
    weekId = existing.rows[0].id;
    status = existing.rows[0].status;
  } else {
    // Create new draft
    const created = await query(
      `INSERT INTO timesheet_weeks (employee_oid, week_start_date, status, total_hours)
       VALUES ($1, $2, 'draft', 0) RETURNING id, status`,
      [employeeOid, weekStartDate]
    );
    weekId = created.rows[0].id;
    status = created.rows[0].status;
  }

  // Auto-generate holidays if in draft status
  if (status === 'draft') {
    await ensureHolidaysForWeek(weekId, weekStartDate);
  }

  return await getWeekWithEntries(weekId);
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
  taskDescription: string, hours: number,
  entryType: string = "Work", jiraTaskId: string | null = null
) => {
  await query(
    `INSERT INTO timesheet_entries (timesheet_week_id, work_date, project_name, task_description, hours, entry_type, jira_task_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [timesheetId, workDate, projectName, taskDescription, hours, entryType, jiraTaskId]
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
  fields: { work_date?: string; project_name?: string; task_description?: string; hours?: number; entry_type?: string; jira_task_id?: string | null }
) => {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (fields.work_date) { sets.push(`work_date = $${i++}`); vals.push(fields.work_date); }
  if (fields.project_name !== undefined) { sets.push(`project_name = $${i++}`); vals.push(fields.project_name); }
  if (fields.task_description) { sets.push(`task_description = $${i++}`); vals.push(fields.task_description); }
  if (fields.hours !== undefined) { sets.push(`hours = $${i++}`); vals.push(fields.hours); }
  if (fields.entry_type !== undefined) { sets.push(`entry_type = $${i++}`); vals.push(fields.entry_type); }
  if (fields.jira_task_id !== undefined) { sets.push(`jira_task_id = $${i++}`); vals.push(fields.jira_task_id); }
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
    const endDate = mon === 12
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
    const endOfMonth = `(date '${startOfMonth}' + interval '1 month' - interval '1 day')`;
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
  const rangeEnd = endDt.toISOString().slice(0, 10);

  console.log("Export filters:", {
    targetOids,
    requestedMonth: `${monthStart} → ${monthEnd}`,
    queryRange: `${rangeStart} → ${rangeEnd}`,
    employeeFilter: employeeOid || "all direct reports",
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

// ─── Create Out of Office timesheet entries after leave approval ─────────────
/**
 * For every workday (Mon–Fri) between startDate and endDate (inclusive),
 * finds or creates the draft timesheet week for the employee, then inserts
 * a single "Out of Office" entry for that day.
 *
 * Duplicate-safe: uses ON CONFLICT DO NOTHING based on the unique constraint
 * on (timesheet_week_id, work_date, is_system_generated) or falls back to
 * a prior-existence check using leave_request_id + work_date.
 *
 * Returns the number of entries inserted.
 */
export const createLeaveTimesheetEntries = async (params: {
  employeeOid: string;
  leaveRequestId: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  leaveType: string;
}): Promise<number> => {
  const { employeeOid, leaveRequestId, startDate, endDate, leaveType } = params;
  const taskDescription = `Approved Leave: ${leaveType}`;
  let insertedCount = 0;

  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dayOfWeek = current.getUTCDay(); // 0=Sun, 6=Sat
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const workDateStr = current.toISOString().slice(0, 10);
      const weekStart = getMondayForDate(workDateStr);

      // Ensure the timesheet week exists (creates draft if absent)
      const week = await getOrCreateWeek(employeeOid, weekStart);

      // Guard: skip if an OOO entry for this leave_request_id + date already exists
      // Also skip if a Holiday entry exists for this date, as Holidays take precedence
      const existing = await query(
        `SELECT id FROM timesheet_entries
         WHERE timesheet_week_id = $1
           AND work_date = $2
           AND (leave_request_id = $3 OR holiday_id IS NOT NULL OR (is_system_generated = true AND project_name = 'Holiday'))`,
        [week.id, workDateStr, leaveRequestId]
      );

      if (existing.rows.length === 0) {
        await query(
          `INSERT INTO timesheet_entries
             (timesheet_week_id, work_date, project_name, task_description, hours,
              is_system_generated, leave_request_id)
           VALUES ($1, $2, 'Out of Office', $3, 8, true, $4)`,
          [week.id, workDateStr, taskDescription, leaveRequestId]
        );

        // Recalculate total_hours for the week
        await query(
          `UPDATE timesheet_weeks SET total_hours = (
             SELECT COALESCE(SUM(hours), 0) FROM timesheet_entries WHERE timesheet_week_id = $1
           ), updated_at = NOW() WHERE id = $1`,
          [week.id]
        );

        insertedCount++;
      }
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return insertedCount;
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
    const endOfMonth = `(date '${startOfMonth}' + interval '1 month' - interval '1 day')`;

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
