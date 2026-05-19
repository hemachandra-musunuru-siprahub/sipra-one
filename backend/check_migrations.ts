import { pool } from "./src/db";

async function run() {
  try {
    const { rows } = await pool.query('SELECT * FROM migrations');
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
