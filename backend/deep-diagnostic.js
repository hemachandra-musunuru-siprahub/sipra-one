// deep-diagnostic.js — Full timesheet data analysis
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.gyjdedfqtescsopleqtj:3inaTeam$intranet@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("\n=== DEEP TIMESHEET DIAGNOSTIC ===\n");

    // 1. Total counts
    const { rows: counts } = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM timesheet_weeks) AS total_weeks,
        (SELECT COUNT(*) FROM timesheet_entries) AS total_entries,
        (SELECT COUNT(*) FROM timesheet_weeks WHERE status != 'draft') AS non_draft_weeks
    `);
    console.log("Overall counts:", counts[0]);

    // 2. Find DUPLICATE (employee_oid, week_start_date) pairs
    const { rows: dups } = await client.query(`
      SELECT tw.employee_oid, u.name,
             tw.week_start_date::date AS week_date,
             COUNT(*) AS timesheet_count,
             SUM((SELECT COUNT(*) FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id)) AS total_entries,
             array_agg(tw.id) AS ids,
             array_agg(tw.status) AS statuses,
             array_agg(tw.total_hours) AS hour_totals
      FROM timesheet_weeks tw
      JOIN users u ON u.entra_oid = tw.employee_oid
      GROUP BY tw.employee_oid, u.name, tw.week_start_date::date
      HAVING COUNT(*) > 1
      ORDER BY u.name, tw.week_start_date::date DESC
    `);
    console.log(`\nDUPLICATE timesheet weeks (same employee + same week date): ${dups.length}`);
    if (dups.length > 0) {
      dups.forEach(d => {
        console.log(`  ${d.name} | ${d.week_date} | ${d.timesheet_count} records | entries: ${d.total_entries}`);
        console.log(`    IDs: ${d.ids.join(', ')}`);
        console.log(`    Statuses: ${d.statuses.join(', ')}`);
        console.log(`    Hours: ${d.hour_totals.join(', ')}`);
      });
    }

    // 3. Timesheets with hours > 0 but 0 entries (orphaned total_hours)
    const { rows: orphaned } = await client.query(`
      SELECT tw.id, tw.week_start_date::date, tw.status, tw.total_hours, u.name,
             (SELECT COUNT(*) FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id) AS entry_count
      FROM timesheet_weeks tw
      JOIN users u ON u.entra_oid = tw.employee_oid
      WHERE tw.total_hours > 0
        AND NOT EXISTS (SELECT 1 FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id)
      ORDER BY u.name, tw.week_start_date::date DESC
    `);
    console.log(`\nTimesheets with total_hours > 0 but ZERO entries: ${orphaned.length}`);
    orphaned.forEach(r => {
      console.log(`  ${r.name} | ${r.week_start_date} | status=${r.status} | hours=${r.total_hours}`);
    });

    // 4. Entries whose timesheet_week is non-draft but week was modified (mismatch check)
    const { rows: sampleEntries } = await client.query(`
      SELECT te.id, te.work_date::date, te.hours, te.project_name, te.entry_type,
             tw.week_start_date::date, tw.status, u.name
      FROM timesheet_entries te
      JOIN timesheet_weeks tw ON tw.id = te.timesheet_week_id
      JOIN users u ON u.entra_oid = tw.employee_oid
      ORDER BY u.name, tw.week_start_date DESC
      LIMIT 20
    `);
    console.log(`\nSample entries (first 20):`);
    sampleEntries.forEach(e => {
      console.log(`  ${e.name} | week=${e.week_start_date} | date=${e.work_date} | ${e.hours}h | ${e.project_name} [${e.status}]`);
    });

    // 5. Entries belonging to orphaned/empty timesheets (pointing to wrong IDs?)
    const { rows: entryTimesheetIds } = await client.query(`
      SELECT DISTINCT timesheet_week_id FROM timesheet_entries
    `);
    console.log(`\nDistinct timesheet_week_ids referenced in entries: ${entryTimesheetIds.length}`);

    // 6. Which IDs in entries don't match any timesheet_weeks?
    const { rows: orphanEntries } = await client.query(`
      SELECT te.id, te.timesheet_week_id, te.work_date::date, te.hours
      FROM timesheet_entries te
      WHERE NOT EXISTS (
        SELECT 1 FROM timesheet_weeks tw WHERE tw.id = te.timesheet_week_id
      )
    `);
    console.log(`\nOrphan entries (no matching timesheet_weeks): ${orphanEntries.length}`);
    if (orphanEntries.length > 0) console.table(orphanEntries);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
