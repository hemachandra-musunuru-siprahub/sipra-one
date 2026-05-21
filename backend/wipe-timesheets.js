// wipe-timesheets.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.gyjdedfqtescsopleqtj:3inaTeam$intranet@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("\n=== WIPING ALL TIMESHEET DATA ===");

    await client.query("BEGIN");

    console.log("Deleting all timesheet entries...");
    const resEntries = await client.query("DELETE FROM timesheet_entries");
    console.log(`  Deleted ${resEntries.rowCount} entries.`);

    console.log("Deleting all timesheet weeks...");
    const resWeeks = await client.query("DELETE FROM timesheet_weeks");
    console.log(`  Deleted ${resWeeks.rowCount} weeks.`);

    await client.query("COMMIT");
    console.log("=== DONE: Database is clean ===");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ERROR:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
