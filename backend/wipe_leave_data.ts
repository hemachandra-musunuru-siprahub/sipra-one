import { pool } from "./src/db";

async function wipeLeaveData() {
  const client = await pool.connect();
  try {
    console.log("Starting hard reset of leave data...");
    await client.query("BEGIN");

    // Drop legacy table if it still exists
    console.log("Dropping legacy leave_policies table...");
    await client.query("DROP TABLE IF EXISTS leave_policies CASCADE");

    // Truncate tables to wipe all data
    console.log("Truncating leave_transactions...");
    await client.query("TRUNCATE TABLE leave_transactions CASCADE");

    console.log("Truncating leave_requests...");
    await client.query("TRUNCATE TABLE leave_requests CASCADE");

    console.log("Truncating leave_balances...");
    await client.query("TRUNCATE TABLE leave_balances CASCADE");

    await client.query("COMMIT");
    console.log("✅ Hard reset complete. All leave data has been wiped.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed to wipe leave data:", err);
  } finally {
    client.release();
    process.exit(0);
  }
}

wipeLeaveData();
