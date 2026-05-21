// show-leave-policies.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.gyjdedfqtescsopleqtj:3inaTeam$intranet@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("\n=== LEAVE POLICIES IN SYSTEM ===\n");
    const { rows } = await client.query(`
      SELECT id, name, description, leave_type, monthly_credit, carry_forward, expire_year_end, is_active 
      FROM leave_policies
    `);
    console.table(rows);

    console.log("\n=== EMPLOYEE ASSIGNMENTS ===\n");
    const { rows: assignments } = await client.query(`
      SELECT u.name AS employee_name, u.email, lp.name AS policy_name, elp.is_active AS assignment_active
      FROM employee_leave_policies elp
      JOIN users u ON u.entra_oid = elp.employee_oid
      JOIN leave_policies lp ON lp.id = elp.policy_id
      ORDER BY u.name
    `);
    console.table(assignments);

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
