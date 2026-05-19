/**
 * backfillLeaveCredits.ts
 *
 * Shared utility — calculates all missing past leave credits for an employee
 * based on their Date of Joining (DOJ) and applies them idempotently.
 *
 * Business Rule: NO leave in the joining month.
 *   Credits start from the 1st of the month AFTER the joining month.
 *
 * Example: DOJ = Feb 25, 2026 → first credit is Mar 1, 2026.
 *
 * Called:
 *   - Automatically when Admin sets/changes an employee's DOJ
 *   - Manually via POST /api/leave-policies/backfill/:oid
 */

import { pool, query } from "../db";
import { createNotification } from "../services/notifications/repo";

export interface BackfillResult {
  employee: string;
  doj: string;
  credited: number;
  skipped: number;
  final_balance: number;
  details: string[];
  message: string;
}

export async function backfillLeaveCredits(oid: string): Promise<BackfillResult> {
  // ── Fetch employee + their active policy ─────────────────────────────────────
  const { rows: empRows } = await query(
    `SELECT u.entra_oid, u.name, u.date_of_joining,
            COALESCE(lp.monthly_credit, 1) AS monthly_credit,
            lp.name AS policy_name
     FROM users u
     LEFT JOIN employee_leave_policies elp
       ON elp.employee_oid = u.entra_oid AND elp.is_active = true
     LEFT JOIN leave_policies lp
       ON lp.id = elp.policy_id AND lp.is_active = true
     WHERE u.entra_oid = $1`,
    [oid]
  );

  if (empRows.length === 0) throw new Error("Employee not found");

  const emp = empRows[0];
  if (!emp.date_of_joining) throw new Error("Employee has no Date of Joining set");

  // Normalize to midnight UTC
  const doj = new Date(emp.date_of_joining);
  doj.setUTCHours(0, 0, 0, 0);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const creditAmount = Number(emp.monthly_credit ?? 1);
  const currentYear = today.getUTCFullYear();

  // ── Build all credit dates ───────────────────────────────────────────────────
  // Rule: NO credit in joining month. First credit = 1st of the NEXT month.
  const creditDates: Date[] = [];

  let cursor = new Date(Date.UTC(doj.getUTCFullYear(), doj.getUTCMonth() + 1, 1));
  while (cursor <= today) {
    creditDates.push(new Date(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }

  const client = await pool.connect();
  let credited = 0;
  let skipped = 0;
  const details: string[] = [];

  try {
    for (const creditDate of creditDates) {
      const dateStr = creditDate.toISOString().slice(0, 10);
      const creditYear = creditDate.getUTCFullYear();

      await client.query("BEGIN");
      try {
        // Idempotency check
        const { rows: existing } = await client.query(
          `SELECT id FROM leave_transactions
           WHERE employee_oid = $1
             AND transaction_type = 'CREDIT'
             AND created_at::date = $2::date
           LIMIT 1`,
          [oid, dateStr]
        );

        if (existing.length > 0) {
          await client.query("ROLLBACK");
          skipped++;
          details.push(`${dateStr}: skipped (already credited)`);
          continue;
        }

        // Ensure leave_balances row exists
        await client.query(
          `INSERT INTO leave_balances
             (employee_oid, leave_type, year, total_days, used_days, remaining_days, available_balance)
           VALUES ($1, 'casual', $2, 0, 0, 0, 0)
           ON CONFLICT (employee_oid, leave_type, year) DO NOTHING`,
          [oid, creditYear]
        );

        // Apply credit
        const { rows: updated } = await client.query(
          `UPDATE leave_balances
           SET available_balance = available_balance + $1,
               total_days        = total_days + $1,
               remaining_days    = remaining_days + $1,
               updated_at        = NOW()
           WHERE employee_oid = $2
             AND leave_type   = 'casual'
             AND year         = $3
           RETURNING available_balance`,
          [creditAmount, oid, creditYear]
        );

        const newBalance = Number(updated[0]?.available_balance ?? creditAmount);
        const reason = `Monthly credit (${dateStr})${emp.policy_name ? ` — Policy: ${emp.policy_name}` : ""}`;

        await client.query(
          `INSERT INTO leave_transactions
             (employee_oid, transaction_type, amount, balance_after, reason, created_by, created_at)
           VALUES ($1, 'CREDIT', $2, $3, $4, 'system-backfill', $5::timestamptz)`,
          [oid, creditAmount, newBalance, reason, creditDate.toISOString()]
        );

        await client.query("COMMIT");
        credited++;
        details.push(`${dateStr}: +${creditAmount} day(s) → balance ${newBalance}`);
      } catch (err) {
        await client.query("ROLLBACK");
        details.push(`${dateStr}: ERROR — ${(err as any).message}`);
      }
    }

    // Final balance
    const { rows: balRows } = await client.query(
      `SELECT available_balance FROM leave_balances
       WHERE employee_oid = $1 AND leave_type = 'casual' AND year = $2`,
      [oid, currentYear]
    );
    const finalBalance = Number(balRows[0]?.available_balance ?? 0);

    if (credited > 0) {
      await createNotification(
        oid,
        "leave_credit",
        "Leave Balance Updated",
        `${credited} leave credit(s) applied. Your current balance is ${finalBalance} day(s).`
      );
    }

    const message = credited > 0
      ? `Backfill complete: ${credited} credit(s) applied, ${skipped} skipped (already existed).`
      : `All credits already up to date. ${skipped} date(s) already had credits.`;

    return {
      employee: emp.name,
      doj: doj.toISOString().slice(0, 10),
      credited,
      skipped,
      final_balance: finalBalance,
      details,
      message,
    };
  } finally {
    client.release();
  }
}
