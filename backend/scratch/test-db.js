const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
});

async function test() {
  console.log('Testing connection to:', process.env.DATABASE_URL.split('@')[1]);
  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully');
    const res = await client.query('SELECT 1');
    console.log('✅ Query successful:', res.rows);
    client.release();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  } finally {
    await pool.end();
  }
}

test();
