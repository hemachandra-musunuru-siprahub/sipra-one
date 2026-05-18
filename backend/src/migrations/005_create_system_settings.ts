/**
 * Migration: Create system_settings table and seed default timesheet reminders.
 *
 * Run: npx ts-node src/migrations/005_create_system_settings.ts
 */

import { query } from "../db";

async function migrate() {
  console.log("Starting migration: create system_settings table...\n");

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        setting_key   VARCHAR(255) PRIMARY KEY,
        setting_value JSONB NOT NULL,
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("✅ Created table: system_settings");

    await query(`
      INSERT INTO system_settings (setting_key, setting_value)
      VALUES (
        'timesheet_reminders',
        '{
          "friday_enabled": true,
          "friday_time": "15:00",
          "monday_enabled": true,
          "monday_time": "09:00"
        }'::jsonb
      )
      ON CONFLICT (setting_key) DO NOTHING
    `);
    console.log("✅ Seeded default settings for timesheet_reminders");

  } catch (e: any) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }

  console.log("\nMigration complete. system_settings table is ready.");
  process.exit(0);
}

migrate();
