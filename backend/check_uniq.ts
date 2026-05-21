import { pool } from "./src/db";
async function test() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT a.attname
      FROM   pg_index i
      JOIN   pg_attribute a ON a.attrelid = i.indrelid
                           AND a.attnum = ANY(i.indkey)
      WHERE  i.indrelid = 'leave_balances'::regclass
      AND    i.indisprimary = false
      AND    i.indisunique = true;
    `);
    console.log(rows);
  } finally {
    client.release();
    process.exit(0);
  }
}
test();
