import { query } from "../src/db";
import dotenv from "dotenv";
dotenv.config();

async function check() {
  try {
    const { rows } = await query("SELECT id, title, status, is_pinned FROM announcements LIMIT 5");
    console.log("ANNOUNCEMENTS IN DB:");
    console.table(rows);
    
    const count = await query("SELECT COUNT(*) FROM announcements");
    console.log("Total Count:", count.rows[0].count);
  } catch (e: any) {
    console.error("DB Error:", e.message);
  } finally {
    process.exit(0);
  }
}
check();
