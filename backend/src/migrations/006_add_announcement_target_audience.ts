/**
 * Migration 006: Add target_audience column to announcements table.
 *
 * Run: npx ts-node src/migrations/006_add_announcement_target_audience.ts
 */

import { query } from "../db";

async function migrate() {
  console.log("Starting migration: add target_audience to announcements...\n");

  try {
    // Add the column with a default of 'ALL' so existing rows are backward compatible
    await query(`
      ALTER TABLE announcements
      ADD COLUMN IF NOT EXISTS target_audience VARCHAR(20) NOT NULL DEFAULT 'ALL'
        CHECK (target_audience IN ('ALL', 'HR', 'MANAGER', 'EMPLOYEE'))
    `);

    // Back-fill any existing rows that somehow have NULL
    await query(`UPDATE announcements SET target_audience = 'ALL' WHERE target_audience IS NULL`);

    console.log("✅  Added target_audience column (default: ALL). All existing announcements set to ALL.");
  } catch (err: any) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
