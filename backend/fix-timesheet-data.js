// fix-timesheet-data.js
// Run: node fix-timesheet-data.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.gyjdedfqtescsopleqtj:3inaTeam$intranet@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("\n=== FIXING TIMESHEET DATA ===");

    await client.query("BEGIN");

    // 1. Reset total_hours to actual sum of entries
    console.log("Reconciling total_hours...");
    const res1 = await client.query(`
      UPDATE timesheet_weeks tw
      SET total_hours = (
        SELECT COALESCE(SUM(hours), 0)
        FROM timesheet_entries te
        WHERE te.timesheet_week_id = tw.id
      ),
      updated_at = NOW()
      WHERE total_hours != (
        SELECT COALESCE(SUM(hours), 0)
        FROM timesheet_entries te
        WHERE te.timesheet_week_id = tw.id
      )
    `);
    console.log(`  Updated ${res1.rowCount} timesheet_weeks with correct total_hours.`);

    // 2. Reset empty non-draft timesheets back to draft
    console.log("Resetting empty submitted/reviewed timesheets to draft...");
    const res2 = await client.query(`
      UPDATE timesheet_weeks tw
      SET status = 'draft',
          submitted_at = NULL,
          reviewed_by_oid = NULL,
          reviewed_at = NULL,
          manager_comment = NULL,
          updated_at = NOW()
      WHERE status IN ('submitted', 'reviewed', 'rejected')
        AND total_hours = 0
        AND NOT EXISTS (
          SELECT 1 FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id
        )
    `);
    console.log(`  Reset ${res2.rowCount} timesheets to draft.`);

    // 3. Add Unique Constraint
    console.log("Ensuring uniqueness constraint...");
    try {
      await client.query(`
        ALTER TABLE timesheet_weeks 
        ADD CONSTRAINT uq_timesheet_weeks_emp_week UNIQUE (employee_oid, week_start_date)
      `);
      console.log("  Added unique constraint on (employee_oid, week_start_date).");
    } catch (err) {
      if (err.code === '42710') { // 42710 is duplicate_object
         console.log("  Unique constraint already exists.");
      } else {
         throw err;
      }
    }

    await client.query("COMMIT");
    console.log("=== DONE ===");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ERROR:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
