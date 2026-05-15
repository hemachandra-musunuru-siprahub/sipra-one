/**
 * Migration: Create holidays table for SipraOne Holiday Calendar module.
 *
 * Run: npx ts-node src/migrations/004_create_holidays.ts
 */

import { query } from "../db";

async function migrate() {
  console.log("Starting migration: create holidays table...\n");

  try {
    // Ensure uuid extension
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await query(`
      CREATE TABLE IF NOT EXISTS holidays (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title           VARCHAR(255) NOT NULL,
        description     TEXT,
        holiday_type    VARCHAR(50) NOT NULL DEFAULT 'company',
        start_date      DATE NOT NULL,
        end_date        DATE NOT NULL,
        is_optional     BOOLEAN NOT NULL DEFAULT FALSE,
        is_recurring    BOOLEAN NOT NULL DEFAULT FALSE,
        status          VARCHAR(20) NOT NULL DEFAULT 'draft',
        organization_id UUID,
        branch_id       UUID,
        department_id   UUID,
        location_id     UUID,
        notify_employees BOOLEAN NOT NULL DEFAULT TRUE,
        created_by      TEXT NOT NULL,
        updated_by      TEXT,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT chk_holiday_type   CHECK (holiday_type IN ('mandatory','optional','festival','regional','company')),
        CONSTRAINT chk_holiday_status CHECK (status IN ('draft','published','archived')),
        CONSTRAINT chk_holiday_dates  CHECK (end_date >= start_date)
      )
    `);
    console.log("✅ Created table: holidays");

    await query(`CREATE INDEX IF NOT EXISTS idx_holidays_status     ON holidays(status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_holidays_start_date ON holidays(start_date)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_holidays_type       ON holidays(holiday_type)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_holidays_created_by ON holidays(created_by)`);
    console.log("✅ Created indexes on holidays");

    // Audit log table for holiday changes
    await query(`
      CREATE TABLE IF NOT EXISTS holiday_audit_logs (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        holiday_id  UUID NOT NULL REFERENCES holidays(id) ON DELETE CASCADE,
        action      VARCHAR(50) NOT NULL,
        changed_by  TEXT NOT NULL,
        changes     JSONB,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log("✅ Created table: holiday_audit_logs");

  } catch (e: any) {
    console.error("❌ Migration failed:", e.message);
    process.exit(1);
  }

  console.log("\nMigration complete. holidays table is ready.");
  process.exit(0);
}

migrate();
