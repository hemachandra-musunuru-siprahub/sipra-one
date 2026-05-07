import { query } from "../src/db";

async function checkDb() {
  try {
    const users = await query("SELECT entra_oid, name, role FROM users");
    console.log("USERS:", users.rows);

    const announcements = await query("SELECT count(*) FROM announcements");
    console.log("ANNOUNCEMENTS COUNT:", announcements.rows[0].count);

    const leave = await query("SELECT count(*) FROM leave_requests");
    console.log("LEAVE REQUESTS COUNT:", leave.rows[0].count);
    
    const leaveRows = await query("SELECT * FROM leave_requests LIMIT 5");
    console.log("LEAVE REQUESTS SAMPLE:", leaveRows.rows);

  } catch (err) {
    console.error("DB CHECK ERROR:", err);
  } finally {
    process.exit();
  }
}

checkDb();
