/**
 * Migration: Leave Policy System
 *
 * Creates:
 *   1. leave_balances.available_balance column (accrual-based paid leave)
 *   2. leave_transactions table (full audit ledger)
 *
 * Business Rules:
 *   - +1 paid leave credit per active employee on the 1st of every month
 *   - Unused credits carry forward throughout the year
 *   - All balances expire on Dec 31st at 23:59
 *   - Jan 1st employees start fresh with the new monthly credit
 *
 * Run: npx ts-node src/migrations/008_create_leave_policy_system.ts
 */

import { query, pool } from "../db";

async function migrate() {
  console.log("Starting migration: Leave Policy System...\n");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. Ensure uuid extension ────────────────────────────────────────────────
    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    console.log("✅ uuid-ossp extension ready");

    // ── 2. Add available_balance to leave_balances (if not exists) ──────────────
    await client.query(`
      ALTER TABLE leave_balances
        ADD COLUMN IF NOT EXISTS available_balance NUMERIC(6,2) NOT NULL DEFAULT 0
    `);
    console.log("✅ leave_balances.available_balance column added");

    // ── 3. Create leave_transactions table ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS leave_transactions (
        id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        employee_oid     TEXT NOT NULL,
        transaction_type VARCHAR(20) NOT NULL,
        amount           NUMERIC(6,2) NOT NULL,
        balance_after    NUMERIC(6,2),
        reason           TEXT,
        leave_request_id UUID,
        created_by       TEXT,
        created_at       TIMESTAMPTZ DEFAULT NOW(),

        CONSTRAINT chk_tx_type CHECK (
          transaction_type IN ('CREDIT','DEBIT','EXPIRE','ADJUSTMENT')
        ),
        CONSTRAINT chk_tx_amount CHECK (amount > 0)
      )
    `);
    console.log("✅ leave_transactions table created");

    // ── 4. Indexes ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leave_tx_employee   ON leave_transactions(employee_oid);
      CREATE INDEX IF NOT EXISTS idx_leave_tx_type       ON leave_transactions(transaction_type);
      CREATE INDEX IF NOT EXISTS idx_leave_tx_created_at ON leave_transactions(created_at DESC);
    `);
    console.log("✅ Indexes created on leave_transactions");

    // ── 5. Seed initial available_balance for existing leave_balances rows ───────
    // For any existing employee balance row that has remaining_days > 0,
    // mirror it into available_balance so the transition is smooth.
    await client.query(`
      UPDATE leave_balances
      SET available_balance = GREATEST(remaining_days, 0)
      WHERE leave_type = 'annual' AND available_balance = 0
    `);
    console.log("✅ Seeded initial available_balance from existing annual leave data");

    // ── 6. Drop legacy leave_policies table ─────────────────────────────────────
    await client.query(`DROP TABLE IF EXISTS leave_policies CASCADE;`);
    console.log("✅ Dropped legacy leave_policies table");

    await client.query("COMMIT");
    console.log("\n✅ Migration complete: Leave Policy System tables are ready.");
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
