import { pool } from "./src/db";

async function verify() {
  const client = await pool.connect();
  try {
    const { rows: t1 } = await client.query("SELECT COUNT(*) FROM leave_transactions");
    const { rows: t2 } = await client.query("SELECT COUNT(*) FROM leave_requests");
    const { rows: t3 } = await client.query("SELECT COUNT(*) FROM leave_balances");
    
    console.log(`leave_transactions rows: ${t1[0].count}`);
    console.log(`leave_requests rows: ${t2[0].count}`);
    console.log(`leave_balances rows: ${t3[0].count}`);
    
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit(0);
  }
}

verify();
