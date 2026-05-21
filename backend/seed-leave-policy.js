const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://postgres.gyjdedfqtescsopleqtj:3inaTeam$intranet@aws-1-ap-south-1.pooler.supabase.com:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    console.log("Seeding default leave policy...");
    const { rows } = await client.query(`
      INSERT INTO leave_policies 
        (name, description, leave_type, monthly_credit, carry_forward, expire_year_end, is_active, created_by_oid)
      VALUES 
        ('Standard Casual Leave', 'System default casual leave policy (1 day per month). Resets at year-end.', 'casual', 1.00, true, true, true, 'system-seed')
      RETURNING *;
    `);
    console.log("Successfully created leave policy:", rows[0]);
  } catch (err) {
    console.error("Error creating policy:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
