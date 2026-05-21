import { pool } from "./src/db";

async function run() {
  try {
    const { rows } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%leave%'
    `);
    console.log('Leave tables:', rows.map(r => r.table_name));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
