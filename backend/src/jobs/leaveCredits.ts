/**
 * Leave Policy Cron Jobs
 *
 * Business Rules:
 *   - Monthly Credit Job: Runs on the 1st of every month at 00:05
 *     → Credits every active employee (policy amount, or default +1)
 *     → SKIPS employees whose joining month = current month (no leave in joining month)
 *     → Idempotent: skips if already credited today
 *
 *   - Year-End Expiry Job: Runs on Dec 31 at 23:59
 *     → Sets available_balance to 0 for employees whose policy has expire_year_end = true
 *     → Creates an EXPIRE transaction showing days lost
 *
 * DOJ Leave Rule (as of updated business requirement):
 *   - Employee joining on Feb 25 → ZERO leave in February
 *   - First credit fires on Mar 1 (first 1st-of-month after joining)
 *   - Past missing credits are backfilled automatically when Admin sets DOJ
 */

import cron from "node-cron";
import { query, pool } from "../db";
import { createNotification } from "../services/notifications/repo";

// ─── MONTHLY CREDIT JOB (1st of every month) ─────────────────────────────────
/**
 * Awards policy-based (or default +1) leave credit to every active employee
 * on the 1st of each month.
 *
 * Skips employees who joined THIS month — no leave in the joining month.
 * Safe to retry: skips employees who already have a CREDIT transaction today.
 */
export async function runMonthlyLeaveCredit() {
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-based
  const today        = now.toISOString().slice(0, 10);

  console.log(`[LEAVE JOBS] Running monthly leave credit job (1st of month) for ${today}...`);

  const client = await pool.connect();
  try {
    // Get all active non-Admin employees with their policy credit amount and DOJ
    const { rows: employees } = await client.query(`
      SELECT u.entra_oid, u.name, u.email,
             u.date_of_joining,
             COALESCE(lp.monthly_credit, 1) AS monthly_credit,
             lp.name AS policy_name
      FROM users u
      LEFT JOIN employee_leave_policies elp
        ON elp.employee_oid = u.entra_oid AND elp.is_active = true
      LEFT JOIN leave_policies lp
        ON lp.id = elp.policy_id AND lp.is_active = true
      WHERE u.is_active = true
        AND u.role != 'Admin'
      ORDER BY u.name
    `);

    console.log(`[LEAVE JOBS] Processing ${employees.length} employees for monthly credit`);

    let credited = 0;
    let skipped  = 0;

    for (const emp of employees) {
      // ── Rule: Skip employees in their joining month ─────────────────────────
      if (emp.date_of_joining) {
        const doj = new Date(emp.date_of_joining);
        const dojYear  = doj.getFullYear();
        const dojMonth = doj.getMonth() + 1; // 1-based

        if (dojYear === currentYear && dojMonth === currentMonth) {
          console.log(`[LEAVE JOBS] Skipping ${emp.name} — joined this month (${emp.date_of_joining}), no leave in joining month`);
          skipped++;
          continue;
        }
      }

      await client.query("BEGIN");
      try {
        // Idempotency: already credited today?
        const { rows: existing } = await client.query(`
          SELECT id FROM leave_transactions
          WHERE employee_oid = $1
            AND transaction_type = 'CREDIT'
            AND created_at::date = $2::date
          LIMIT 1
        `, [emp.entra_oid, today]);

        if (existing.length > 0) {
          await client.query("ROLLBACK");
          skipped++;
          continue;
        }

        const creditAmount = Number(emp.monthly_credit ?? 1);

        // Ensure balance row exists
        await client.query(`
          INSERT INTO leave_balances
            (employee_oid, leave_type, year, total_days, used_days, remaining_days, available_balance)
          VALUES ($1, 'casual', $2, 0, 0, 0, 0)
          ON CONFLICT (employee_oid, leave_type, year) DO NOTHING
        `, [emp.entra_oid, currentYear]);

        // Add credit
        const { rows: updated } = await client.query(`
          UPDATE leave_balances
          SET available_balance = available_balance + $1,
              total_days = total_days + $1,
              remaining_days = remaining_days + $1,
              updated_at = NOW()
          WHERE employee_oid = $2
            AND leave_type = 'casual'
            AND year = $3
          RETURNING available_balance
        `, [creditAmount, emp.entra_oid, currentYear]);

        const newBalance = Number(updated[0]?.available_balance ?? creditAmount);

        const reason = emp.policy_name
          ? `Monthly leave credit (Policy: ${emp.policy_name})`
          : "Monthly leave credit";

        await client.query(`
          INSERT INTO leave_transactions
            (employee_oid, transaction_type, amount, balance_after, reason, created_by)
          VALUES ($1, 'CREDIT', $2, $3, $4, 'system')
        `, [emp.entra_oid, creditAmount, newBalance, reason]);

        await client.query("COMMIT");
        credited++;

        await createNotification(
          emp.entra_oid,
          "leave_credit",
          "Monthly Leave Credit Applied",
          `Your monthly leave credit of ${creditAmount} day(s) has been added. Your available balance is now ${newBalance} day(s).`
        );
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[LEAVE JOBS] Failed to credit employee ${emp.entra_oid}:`, err);
      }
    }

    console.log(`[LEAVE JOBS] Monthly credit complete. Credited: ${credited}, Skipped: ${skipped}`);
  } catch (err) {
    console.error("[LEAVE JOBS] Fatal error in monthly credit job:", err);
  } finally {
    client.release();
  }
}

// ─── YEAR-END EXPIRY JOB ─────────────────────────────────────────────────────
export async function runYearEndLeaveExpiry() {
  console.log("[LEAVE JOBS] Running year-end leave expiry job...");

  const client = await pool.connect();
  try {
    const currentYear = new Date().getFullYear();
    const today = new Date().toISOString().slice(0, 10);

    // Idempotency
    const { rows: alreadyExpired } = await client.query(`
      SELECT COUNT(*) as cnt
      FROM leave_transactions
      WHERE transaction_type = 'EXPIRE'
        AND created_at::date = $1::date
    `, [today]);

    if (Number(alreadyExpired[0]?.cnt) > 0) {
      console.log("[LEAVE JOBS] Year-end expiry already completed for today. Skipping.");
      return;
    }

    // Only expire employees whose policy has expire_year_end = true (or no policy)
    const { rows: balances } = await client.query(`
      SELECT lb.employee_oid, lb.available_balance, u.name,
             COALESCE(lp.expire_year_end, true) AS expire_year_end
      FROM leave_balances lb
      JOIN users u ON u.entra_oid = lb.employee_oid
      LEFT JOIN employee_leave_policies elp
        ON elp.employee_oid = lb.employee_oid AND elp.is_active = true
      LEFT JOIN leave_policies lp
        ON lp.id = elp.policy_id AND lp.is_active = true
      WHERE lb.leave_type = 'casual'
        AND lb.year = $1
        AND lb.available_balance > 0
    `, [currentYear]);

    console.log(`[LEAVE JOBS] Checking ${balances.length} employees for year-end expiry`);

    let expired = 0;
    for (const bal of balances) {
      if (!bal.expire_year_end) continue; // policy says carry forward

      await client.query("BEGIN");
      try {
        const expiredAmount = Number(bal.available_balance);

        await client.query(`
          UPDATE leave_balances
          SET available_balance = 0,
              remaining_days = 0,
              updated_at = NOW()
          WHERE employee_oid = $1
            AND leave_type = 'casual'
            AND year = $2
        `, [bal.employee_oid, currentYear]);

        await client.query(`
          INSERT INTO leave_transactions
            (employee_oid, transaction_type, amount, balance_after, reason, created_by)
          VALUES ($1, 'EXPIRE', $2, 0, 'Year-end leave balance expiry (Dec 31)', 'system')
        `, [bal.employee_oid, expiredAmount]);

        await client.query("COMMIT");
        expired++;

        await createNotification(
          bal.employee_oid,
          "leave_expired",
          "Year-End Leave Balance Expired",
          `Your unused leave balance of ${expiredAmount} day(s) has expired as of December 31st. ` +
          `Your balance has been reset to 0. A fresh credit will be added on January 1st.`
        );
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`[LEAVE JOBS] Failed to expire leave for ${bal.employee_oid}:`, err);
      }
    }

    console.log(`[LEAVE JOBS] Year-end expiry complete. Expired balances: ${expired}`);
  } catch (err) {
    console.error("[LEAVE JOBS] Fatal error in year-end expiry job:", err);
  } finally {
    client.release();
  }
}

// ─── INITIALIZATION ───────────────────────────────────────────────────────────
export function initLeaveJobs() {
  // Monthly credit: 1st of every month at 00:05 for ALL eligible employees
  // (employees in their joining month are automatically skipped)
  cron.schedule("5 0 1 * *", () => {
    console.log("[LEAVE JOBS] Monthly credit cron triggered (1st of month)");
    runMonthlyLeaveCredit().catch(console.error);
  });
  console.log("[LEAVE JOBS] Scheduled: Monthly credit on 1st of each month at 00:05");

  // Year-end expiry: Dec 31st at 23:59
  cron.schedule("59 23 31 12 *", () => {
    console.log("[LEAVE JOBS] Year-end expiry cron triggered");
    runYearEndLeaveExpiry().catch(console.error);
  });
  console.log("[LEAVE JOBS] Scheduled: Year-end expiry on Dec 31 at 23:59");
}
