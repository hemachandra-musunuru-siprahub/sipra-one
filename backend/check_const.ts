import { pool } from "./src/db";
async function test() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'leave_balances'
    `);
    console.log(rows);
  } finally {
    client.release();
    process.exit(0);
  }
}
test();
