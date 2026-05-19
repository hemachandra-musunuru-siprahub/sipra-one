import { pool } from "./src/db";
async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Rename annual -> casual in leave_balances
    const { rowCount: balRows } = await client.query(
      `UPDATE leave_balances SET leave_type = 'casual' WHERE leave_type = 'annual'`
    );
    console.log(`Updated ${balRows} leave_balance rows: annual -> casual`);
    await client.query("COMMIT");
    console.log("Migration complete!");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", e);
    throw e;
  } finally {
    client.release();
    process.exit(0);
  }
}
migrate();
