import { Pool, types } from "pg";
import dotenv from "dotenv";

dotenv.config();

// Force DATE (OID 1082) to be returned as a string YYYY-MM-DD
// instead of a Date object that gets shifted by local timezone
types.setTypeParser(1082, (val) => val);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" 
    ? { rejectUnauthorized: true } 
    : { rejectUnauthorized: false },
});

// A small utility function to help with querying
export const query = (text: string, params?: any[]) => pool.query(text, params);
