/**
 * Migration 007: Add is_archived and archived_at columns to announcements table.
 *
 * Run: npx ts-node src/migrations/007_add_announcement_archive.ts
 */

import { query } from "../db";

async function migrate() {
  console.log("Starting migration: add is_archived and archived_at to announcements...\n");

  try {
    await query(`
      ALTER TABLE announcements
      ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP
    `);

    console.log("✅  Added is_archived (default: false) and archived_at columns.");
  } catch (err: any) {
    console.error("❌  Migration failed:", err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrate();
