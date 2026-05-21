/**
 * recalculateLeaveCredits.ts
 *
 * Full reset + recompute utility.
 *
 * Steps:
 *   1. Find all system-generated CREDIT transactions for the employee
 *   2. Remove them and reduce the balance accordingly
 *   3. Run backfill with the current correct rule:
 *      → NO credit in joining month
 *      → Credits start from 1st of month AFTER joining
 *
 * Safe: does NOT touch manual adjustments (HR-entered credits/debits).
 * System credits are identified by created_by IN ('system', 'system-backfill').
 */

import { pool, query } from "../db";
import { backfillLeaveCredits, BackfillResult } from "./backfillLeaveCredits";
import { createNotification } from "../services/notifications/repo";

export interface RecalculateResult extends BackfillResult {
  removed: number;
  removed_amount: number;
}

export async function recalculateLeaveCredits(oid: string): Promise<RecalculateResult> {
  // ── Verify employee exists and has DOJ ───────────────────────────────────────
  const { rows: empRows } = await query(
    `SELECT entra_oid, name, date_of_joining FROM users WHERE entra_oid = $1`,
    [oid]
  );
  if (empRows.length === 0) throw new Error("Employee not found");
  const emp = empRows[0];
  if (!emp.date_of_joining) throw new Error("Employee has no Date of Joining set");

  const client = await pool.connect();
  let removed = 0;
  let removedAmount = 0;

  try {
    await client.query("BEGIN");

    // ── Step 1: Find all system-generated CREDIT transactions ────────────────
    const { rows: sysCreds } = await client.query(
      `SELECT id, amount, created_at::date AS credit_date
       FROM leave_transactions
       WHERE employee_oid = $1
         AND transaction_type = 'CREDIT'
         AND created_by IN ('system', 'system-backfill')
       ORDER BY created_at ASC`,
      [oid]
    );

    // ── Step 2: Sum what we're removing ──────────────────────────────────────
    for (const row of sysCreds) {
      removedAmount += Number(row.amount);
      removed++;
    }

    if (removed > 0) {
      const currentYear = new Date().getFullYear();

      // ── Step 3: Delete all system credits ──────────────────────────────────
      await client.query(
        `DELETE FROM leave_transactions
         WHERE employee_oid = $1
           AND transaction_type = 'CREDIT'
           AND created_by IN ('system', 'system-backfill')`,
        [oid]
      );

      // ── Step 4: Reset balance to 0 (system credits only were adding to it)
      //           Preserve manually adjusted balances by recalculating:
      //           remaining = total_manual_credit - total_used
      //           We do a full reset of available_balance to 0 here since
      //           backfill will recompute from scratch.
      await client.query(
        `UPDATE leave_balances
         SET available_balance = GREATEST(available_balance - $1, 0),
             total_days        = GREATEST(total_days - $1, 0),
             remaining_days    = GREATEST(remaining_days - $1, 0),
             updated_at        = NOW()
         WHERE employee_oid = $2
           AND leave_type   = 'casual'
           AND year         = $3`,
        [removedAmount, oid, currentYear]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // ── Step 5: Re-run backfill with correct rule ─────────────────────────────
  const backfill = await backfillLeaveCredits(oid);

  if (removed > 0 || backfill.credited > 0) {
    await createNotification(
      oid,
      "leave_credit",
      "Leave Balance Recalculated",
      `Your leave balance has been recalculated. ` +
      `${removed} incorrect credit(s) removed, ` +
      `${backfill.credited} correct credit(s) applied. ` +
      `Current balance: ${backfill.final_balance} day(s).`
    );
  }

  return {
    ...backfill,
    removed,
    removed_amount: removedAmount,
    message: removed > 0
      ? `Recalculation complete: removed ${removed} incorrect credit(s) (${removedAmount} day(s)), applied ${backfill.credited} correct credit(s). Balance: ${backfill.final_balance} day(s).`
      : `No incorrect credits found. ${backfill.message}`,
  };
}
