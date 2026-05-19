/**
 * Migration 009: Leave Policy Engine
 *
 * Creates:
 *   1. users.date_of_joining      — tracks when each employee joined
 *   2. leave_policies              — HR/Admin-defined policy templates
 *   3. employee_leave_policies     — which employees are on which policy
 *
 * Credit Rule (per product spec):
 *   - First credit fires on the employee's exact DOJ date
 *   - Subsequent credits fire on the 1st of every month (existing cron)
 *
 * Run: npx ts-node src/migrations/009_leave_policy_engine.ts
 */

import { query, pool } from "../db";

async function migrate() {
  console.log("Starting migration 009: Leave Policy Engine...\n");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. Ensure uuid-ossp extension ────────────────────────────────────────
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── 2. Add date_of_joining to users ──────────────────────────────────────
    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS date_of_joining DATE
    `);
    console.log("✅ users.date_of_joining column added");

    // ── 3. Create leave_policies master table ─────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_policies (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name            TEXT NOT NULL,
        description     TEXT,
        leave_type      TEXT NOT NULL DEFAULT 'casual',
        monthly_credit  NUMERIC(4,2) NOT NULL DEFAULT 1.00,
        carry_forward   BOOLEAN NOT NULL DEFAULT true,
        expire_year_end BOOLEAN NOT NULL DEFAULT true,
        is_active       BOOLEAN NOT NULL DEFAULT true,
        created_by_oid  TEXT NOT NULL,
        created_at      TIMESTAMPTZ DEFAULT NOW(),
        updated_at      TIMESTAMPTZ DEFAULT NOW(),

        CONSTRAINT chk_lp_leave_type    CHECK (leave_type IN ('casual', 'sick', 'annual')),
        CONSTRAINT chk_lp_monthly_credit CHECK (monthly_credit > 0)
      )
    `);
    console.log("✅ leave_policies table created");

    // ── 4. Create employee_leave_policies assignment table ─────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_leave_policies (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        employee_oid TEXT NOT NULL,
        policy_id    UUID NOT NULL REFERENCES leave_policies(id) ON DELETE CASCADE,
        assigned_by  TEXT NOT NULL,
        assigned_at  TIMESTAMPTZ DEFAULT NOW(),
        is_active    BOOLEAN NOT NULL DEFAULT true,
        UNIQUE(employee_oid, policy_id)
      )
    `);
    console.log("✅ employee_leave_policies table created");

    // ── 5. Indexes ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_elp_employee ON employee_leave_policies(employee_oid);
      CREATE INDEX IF NOT EXISTS idx_elp_policy   ON employee_leave_policies(policy_id);
      CREATE INDEX IF NOT EXISTS idx_elp_active   ON employee_leave_policies(is_active);
      CREATE INDEX IF NOT EXISTS idx_lp_active    ON leave_policies(is_active);
    `);
    console.log("✅ Indexes created");

    await client.query("COMMIT");
    console.log("\n✅ Migration 009 complete: Leave Policy Engine is ready.");
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
