import { pool } from "./src/db";

async function fix() {
  const client = await pool.connect();
  try {
    console.log("Fixing legacy balances...");
    const { rows } = await client.query(`
      SELECT employee_oid, year, available_balance 
      FROM leave_balances 
      WHERE leave_type = 'annual' AND available_balance > 0
    `);
    
    console.log(`Found ${rows.length} rows with available_balance > 0`);

    let count = 0;
    for (const row of rows) {
      const { rows: txs } = await client.query(
        "SELECT id FROM leave_transactions WHERE employee_oid = $1",
        [row.employee_oid]
      );
      if (txs.length === 0) {
        console.log(`Inserting initial CREDIT for ${row.employee_oid}: ${row.available_balance}`);
        await client.query(
          `INSERT INTO leave_transactions (employee_oid, transaction_type, amount, balance_after, reason, created_by)
           VALUES ($1, 'CREDIT', $2, $3, 'System migration: legacy balance rollover', 'system')`,
          [row.employee_oid, row.available_balance, row.available_balance]
        );
        count++;
      }
    }
    console.log(`Inserted ${count} missing initial transactions.`);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

fix();
