/**
 * Migration: Remove role columns from users table
 *
 * Roles are managed exclusively by Microsoft Entra ID and stored in
 * the session JWT. The database must not store role data.
 *
 * Run: npx ts-node src/migrations/001_drop_role_columns.ts
 */

import { query } from "../db";

async function migrate() {
  console.log("Starting migration: drop role columns from users table...\n");

  try {
    await query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS effective_role,
        DROP COLUMN IF EXISTS role_source,
        DROP COLUMN IF EXISTS azure_groups
    `);
    console.log("✅ Dropped columns: effective_role, role_source, azure_groups");
  } catch (e: any) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }

  console.log("\nMigration complete. Users table now stores identity data only.");
  process.exit(0);
}

migrate();
