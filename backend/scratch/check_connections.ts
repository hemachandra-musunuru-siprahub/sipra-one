import { query } from "../src/db";
import dotenv from "dotenv";
dotenv.config();

async function check() {
  try {
    const { rows } = await query("SELECT count(*) FROM pg_stat_activity");
    console.log("ACTIVE DB CONNECTIONS:", rows[0].count);
    
    const details = await query("SELECT pid, state, query, wait_event_type, wait_event FROM pg_stat_activity");
    console.table(details.rows);
  } catch (e: any) {
    console.error("DB Error:", e.message);
  } finally {
    process.exit(0);
  }
}
check();
