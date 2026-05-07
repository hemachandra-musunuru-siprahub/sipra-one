import { query } from "../src/db";
import dotenv from "dotenv";
dotenv.config();

async function check() {
  try {
    const { rows } = await query("SELECT id, name, email, role, entra_oid, is_active FROM users");
    console.log("USERS IN DB:");
    console.table(rows);
  } catch (e: any) {
    console.error("DB Error:", e.message);
  } finally {
    process.exit(0);
  }
}
check();
