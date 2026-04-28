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

// ─── Team timesheets (manager) ────────────────────────────────────────────────
export const getTeamTimesheets = async (directReportOids: string[]) => {
  if (directReportOids.length === 0) return [];
  const placeholders = directReportOids.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await query(
    `SELECT tw.*, u.name AS employee_name,
       COALESCE(json_agg(te ORDER BY te.work_date) FILTER (WHERE te.id IS NOT NULL), '[]') AS entries
     FROM timesheet_weeks tw
     JOIN users u ON u.entra_oid = tw.employee_oid
     LEFT JOIN timesheet_entries te ON te.timesheet_week_id = tw.id
     WHERE tw.employee_oid IN (${placeholders}) AND tw.status IN ('submitted', 'reviewed')
     GROUP BY tw.id, u.name
     ORDER BY tw.week_start_date DESC`,
    directReportOids
  );
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
