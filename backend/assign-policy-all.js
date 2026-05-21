const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.gyjdedfqtescsopleqtj:3inaTeam$intranet@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Assigning 'Standard Casual Leave' policy to all non-Admin active employees...");
    
    // 1. Get the policy ID
    const { rows: policyRows } = await client.query(
      `SELECT id FROM leave_policies WHERE name = 'Standard Casual Leave' LIMIT 1`
    );
    
    if (policyRows.length === 0) {
      console.error("Policy 'Standard Casual Leave' not found!");
      return;
    }
    const policyId = policyRows[0].id;
    console.log(`Found Policy ID: ${policyId}`);

    // 2. Get all non-Admin active employees
    const { rows: users } = await client.query(
      `SELECT entra_oid, name FROM users WHERE is_active = true AND role != 'Admin'`
    );
    console.log(`Found ${users.length} active employees.`);

    await client.query("BEGIN");

    let assignedCount = 0;
    for (const user of users) {
      // Check if already assigned
      const { rows: existing } = await client.query(
        `SELECT id FROM employee_leave_policies WHERE employee_oid = $1 AND policy_id = $2`,
        [user.entra_oid, policyId]
      );

      if (existing.length === 0) {
        await client.query(
          `INSERT INTO employee_leave_policies (employee_oid, policy_id, assigned_by, is_active)
           VALUES ($1, $2, 'system-seed', true)`,
          [user.entra_oid, policyId]
        );
        assignedCount++;
      }
    }

    await client.query("COMMIT");
    console.log(`Successfully assigned policy to ${assignedCount} new employees.`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error during assignment:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
