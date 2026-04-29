import { query } from "./db";

async function check() {
  try {
    const { rows } = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public'");
    console.log("Columns in users table:");
    console.table(rows);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
