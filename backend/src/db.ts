import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// A small utility function to help with querying
export const query = (text: string, params?: any[]) => pool.query(text, params);
