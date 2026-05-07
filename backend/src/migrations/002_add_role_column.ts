/**
 * Migration: Add centralized `role` column to users table.
 *
 * Moves role management from Microsoft Entra ID JWT claims into the local
 * PostgreSQL database.  Admins can now change a user's role directly via
 * the SipraHub Admin UI; Entra ID roles are only used to seed the value
 * on a user's very first login.
 *
 * Strategy:
 *   1. Add the `role` column (default 'Employee').
 *   2. Drop the now-obsolete columns: effective_role, role_source, azure_groups.
 *   3. Add a CHECK constraint to limit allowed values.
 *
 * Run: npx ts-node src/migrations/002_add_role_column.ts
 */

import { query } from "../db";

async function migrate() {
  console.log("Starting migration: add role column to users table...\n");

  try {
    // Step 1 — Add role column if it doesn't already exist
    await query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'Employee'
    `);
    console.log("✅ Added column: role (default 'Employee')");

    // Step 2 — Drop obsolete columns (safe: IF EXISTS)
    await query(`
      ALTER TABLE users
        DROP COLUMN IF EXISTS effective_role,
        DROP COLUMN IF EXISTS role_source,
        DROP COLUMN IF EXISTS azure_groups
    `);
    console.log("✅ Dropped obsolete columns: effective_role, role_source, azure_groups");

    // Step 3 — Add CHECK constraint for allowed role values
    await query(`
      ALTER TABLE users
        DROP CONSTRAINT IF EXISTS chk_user_role
    `);
    await query(`
      ALTER TABLE users
        ADD CONSTRAINT chk_user_role
        CHECK (role IN ('Admin', 'HR', 'Manager', 'Employee'))
    `);
    console.log("✅ Added constraint: chk_user_role");

  } catch (e: any) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }

  console.log("\nMigration complete.");
  console.log("Users now have a 'role' column managed locally by SipraHub Admins.");
  console.log("Entra ID roles are used only to seed role on first login.\n");
  process.exit(0);
}

migrate();
