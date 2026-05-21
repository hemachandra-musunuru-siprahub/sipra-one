// diagnostic-timesheets.js
// Run: node diagnostic-timesheets.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.gyjdedfqtescsopleqtj:3inaTeam$intranet@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("\n=== TIMESHEET DIAGNOSTIC ===\n");

    // 1. Find Hemachandra's timesheets
    const { rows: timesheets } = await client.query(`
      SELECT tw.id, tw.employee_oid, tw.week_start_date, tw.status, tw.total_hours,
             u.name, u.role,
             (SELECT COUNT(*) FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id) AS entry_count
      FROM timesheet_weeks tw
      JOIN users u ON u.entra_oid = tw.employee_oid
      WHERE u.name ILIKE '%hemachandra%'
      ORDER BY tw.week_start_date DESC
      LIMIT 10
    `);
    console.log("Hemachandra's timesheets:");
    console.table(timesheets);

    // 2. Check entries for the current week
    if (timesheets.length > 0) {
      const currentWeekTs = timesheets[0];
      const { rows: entries } = await client.query(`
        SELECT id, work_date, project_name, task_description, hours, entry_type, is_system_generated
        FROM timesheet_entries
        WHERE timesheet_week_id = $1
        ORDER BY work_date
      `, [currentWeekTs.id]);
      console.log(`\nEntries for timesheet ${currentWeekTs.id} (week ${currentWeekTs.week_start_date}, status: ${currentWeekTs.status}):`);
      if (entries.length === 0) {
        console.log("  *** NO ENTRIES IN DB ***");
      } else {
        console.table(entries);
      }
    }

    // 3. Show ALL timesheets with status=reviewed + 0 entries
    const { rows: badTimesheets } = await client.query(`
      SELECT tw.id, tw.week_start_date, tw.status, u.name, u.role,
             (SELECT COUNT(*) FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id) AS entry_count
      FROM timesheet_weeks tw
      JOIN users u ON u.entra_oid = tw.employee_oid
      WHERE tw.status IN ('reviewed', 'submitted')
        AND NOT EXISTS (SELECT 1 FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id)
      ORDER BY tw.week_start_date DESC
    `);
    console.log("\nAll reviewed/submitted timesheets with ZERO entries (data corruption):");
    console.table(badTimesheets);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
