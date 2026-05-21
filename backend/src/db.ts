import { Pool, types } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Force DATE (OID 1082) to be returned as a string YYYY-MM-DD
// instead of a Date object that gets shifted by local timezone
types.setTypeParser(1082, (val) => val);

const isProd = process.env.NODE_ENV === "production";

// Configure SSL based on environment
const sslConfig = isProd
  ? { rejectUnauthorized: false }
  : false;

console.log("--------------------------------------------------");
console.log(`[DATABASE] Initializing PostgreSQL Pool`);
console.log(`[DATABASE]   Environment:     ${process.env.NODE_ENV || "development"}`);
console.log(`[DATABASE]   SSL Enabled:     ${!!sslConfig}`);
if (sslConfig) {
  console.log(`[DATABASE]   SSL Mode:        rejectUnauthorized = false`);
}
console.log("--------------------------------------------------");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
});

// A small utility function to help with querying
export const query = (text: string, params?: any[]) => pool.query(text, params);
