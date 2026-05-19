// fix-timesheet-dates.js
// One-time script: normalizes all week_start_date to YYYY-MM-DD (IST Monday)
// Run: node fix-timesheet-dates.js

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.gyjdedfqtescsopleqtj:3inaTeam$intranet@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

// Convert a UTC timestamp stored in DB to the correct IST YYYY-MM-DD Monday
// IST = UTC + 5:30, so 2026-05-17T18:30:00Z = 2026-05-18 00:00 IST = Monday May 18
function toISTDateString(utcTimestamp) {
  const d = new Date(utcTimestamp);
  // Add 5h30m for IST
  const istMs = d.getTime() + (5.5 * 60 * 60 * 1000);
  const ist = new Date(istMs);
  const year = ist.getUTCFullYear();
  const month = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ist.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function run() {
  const client = await pool.connect();
  try {
    console.log("\n=== FIX TIMESHEET WEEK_START_DATE ===\n");

    // 1. Find all timesheets where week_start_date is stored as a timestamp (not plain date)
    const { rows: allTimesheets } = await client.query(`
      SELECT id, week_start_date, employee_oid
      FROM timesheet_weeks
      ORDER BY week_start_date DESC
    `);

    let fixed = 0;
    let skipped = 0;
    const toFix = [];

    for (const ts of allTimesheets) {
      const raw = ts.week_start_date;
      const rawStr = raw instanceof Date ? raw.toISOString() : String(raw);

      // If it looks like a pure date (YYYY-MM-DD), skip
      const plainDateMatch = rawStr.match(/^(\d{4}-\d{2}-\d{2})T00:00:00\.000Z$/);
      if (plainDateMatch && rawStr.endsWith("T00:00:00.000Z")) {
        // Pure UTC midnight — could be correct OR could be IST midnight stored as UTC midnight
        // If it ends in T00:00:00.000Z it's likely fine already (stored as date)
        skipped++;
        continue;
      }

      // If it's anything else (like T18:30:00.000Z for IST midnight), fix it
      const correctDate = toISTDateString(rawStr);
      toFix.push({ id: ts.id, raw: rawStr, correct: correctDate });
    }

    console.log(`Found ${toFix.length} timesheets needing correction:`);
    for (const item of toFix) {
      console.log(`  ${item.id}: ${item.raw} → ${item.correct}`);
    }

    if (toFix.length === 0) {
      console.log("\nNo fix needed! All dates are correct.");

      // Show what the current week IS in the DB for Hemachandra
      const { rows: hema } = await client.query(`
        SELECT id, week_start_date::text, status,
               (SELECT COUNT(*) FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id) AS entry_count,
               (SELECT COALESCE(SUM(hours),0) FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id) AS real_hours
        FROM timesheet_weeks tw
        JOIN users u ON u.entra_oid = tw.employee_oid
        WHERE u.name ILIKE '%hemachandra%'
        ORDER BY week_start_date DESC
        LIMIT 5
      `);
      console.log("\nHemachandra current state:");
      console.table(hema);
      return;
    }

    // Fix them
    await client.query("BEGIN");
    try {
      for (const item of toFix) {
        await client.query(
          `UPDATE timesheet_weeks SET week_start_date = $1::date WHERE id = $2`,
          [item.correct, item.id]
        );
        fixed++;
      }
      await client.query("COMMIT");
      console.log(`\n✅ Fixed ${fixed} timesheets.`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }

    // 2. Now check entries — their work_date might also be wrong
    const { rows: entries } = await client.query(`
      SELECT id, work_date::text, timesheet_week_id
      FROM timesheet_entries
      LIMIT 5
    `);
    console.log("\nSample entries (work_date check):");
    console.table(entries);

    // 3. Final state
    const { rows: afterFix } = await client.query(`
      SELECT id, week_start_date::text, status,
             (SELECT COUNT(*) FROM timesheet_entries te WHERE te.timesheet_week_id = tw.id) AS entry_count
      FROM timesheet_weeks tw
      JOIN users u ON u.entra_oid = tw.employee_oid
      WHERE u.name ILIKE '%hemachandra%'
      ORDER BY week_start_date DESC
      LIMIT 5
    `);
    console.log("\nHemachandra after fix:");
    console.table(afterFix);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
