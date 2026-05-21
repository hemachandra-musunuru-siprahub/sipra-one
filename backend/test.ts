import { pool } from "./src/db";

async function test() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT * FROM leave_transactions WHERE transaction_type = 'CREDIT'`);
    console.log('CREDIT tx count:', rows.length);
    if(rows.length > 0) {
      console.log('Sample tx:', rows[0]);
    }
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    process.exit(0);
  }
}

test();
