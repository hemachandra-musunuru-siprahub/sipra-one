import { query, pool } from "../../db";

// ─── Get own leave requests (with filters) ────────────────────────────────────
export const getOwnRequests = async (employeeOid: string, filters: { month?: string } = {}) => {
  let queryStr = `
     SELECT lr.*, m.name AS manager_name
     FROM leave_requests lr
     LEFT JOIN users m ON m.entra_oid = lr.manager_oid
     WHERE lr.employee_oid = $1
  `;
  const params: any[] = [employeeOid];
  let paramIdx = 2;

  if (filters.month) {
    const [year, mon] = filters.month.split("-").map(Number);
    const startDate = `${filters.month}-01`;
    const endDate = mon === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mon + 1).padStart(2, "0")}-01`;

    queryStr += ` AND lr.start_date < $${paramIdx++} AND lr.end_date >= $${paramIdx++}`;
    params.push(endDate, startDate);
  }

  queryStr += ` ORDER BY lr.created_at DESC`;

  const { rows } = await query(queryStr, params);
  return rows;
};

// ─── Create leave request ─────────────────────────────────────────────────────
export const createRequest = async (
  employeeOid: string, managerOid: string, leaveType: string,
  startDate: string, endDate: string, totalDays: number, reason?: string,
  medicalCertificateName?: string, medicalCertificateData?: string, medicalCertificateMime?: string
) => {
  const { rows } = await query(
    `INSERT INTO leave_requests
       (employee_oid, manager_oid, leave_type, start_date, end_date, total_days, reason, status,
        medical_certificate_name, medical_certificate_data, medical_certificate_mime)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10) RETURNING *`,
    [employeeOid, managerOid, leaveType, startDate, endDate, totalDays, reason || null,
      medicalCertificateName || null, medicalCertificateData || null, medicalCertificateMime || null]
  );
  return rows[0];
};

// ─── Get team pending leave (manager) ────────────────────────────────────────
export const getTeamRequests = async (directReportOids: string[]) => {
  if (directReportOids.length === 0) return [];
  const placeholders = directReportOids.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await query(
    `SELECT DISTINCT lr.*, u.name AS employee_name
     FROM leave_requests lr
     LEFT JOIN users u ON u.entra_oid = lr.employee_oid
     WHERE lr.employee_oid IN (${placeholders})
     ORDER BY lr.created_at DESC`,
    directReportOids
  );
  return rows;
};

// ─── Get all leave requests (HR/Admin/Manager — with filters) ──────────────────
export const getAllRequests = async (filters: { month?: string, status?: string, search?: string } = {}) => {
  let queryStr = `
     SELECT DISTINCT lr.*,
            emp.name AS employee_name,
            mgr.name AS manager_name
     FROM leave_requests lr
     LEFT JOIN users emp ON emp.entra_oid = lr.employee_oid
     LEFT JOIN users mgr ON mgr.entra_oid = lr.manager_oid
     WHERE 1=1
  `;
  const params: any[] = [];
  let paramIdx = 1;

  if (filters.status && filters.status !== 'all') {
    queryStr += ` AND lr.status = $${paramIdx++}`;
    params.push(filters.status);
  }

  if (filters.search) {
    queryStr += ` AND (emp.name ILIKE $${paramIdx} OR emp.email ILIKE $${paramIdx} OR mgr.name ILIKE $${paramIdx})`;
    params.push(`%${filters.search}%`);
    paramIdx++;
  }

  if (filters.month) {
    const [year, mon] = filters.month.split("-").map(Number);
    const startDate = `${filters.month}-01`;
    const endDate = mon === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mon + 1).padStart(2, "0")}-01`;

    queryStr += ` AND lr.start_date < $${paramIdx++} AND lr.end_date >= $${paramIdx++}`;
    params.push(endDate, startDate);
  }

  queryStr += ` ORDER BY lr.created_at DESC`;

  const { rows } = await query(queryStr, params);
  return rows;
};

// ─── Get leave requests where the caller is the approving manager ──────────────
export const getManagerRequests = async (managerOid: string, filters: { month?: string, status?: string, search?: string } = {}) => {
  let queryStr = `
     SELECT DISTINCT lr.*,
            emp.name AS employee_name,
            mgr.name AS manager_name
     FROM leave_requests lr
     LEFT JOIN users emp ON emp.entra_oid = lr.employee_oid
     LEFT JOIN users mgr ON mgr.entra_oid = lr.manager_oid
     WHERE lr.manager_oid = $1
  `;
  const params: any[] = [managerOid];
  let paramIdx = 2;

  if (filters.status && filters.status !== 'all') {
    queryStr += ` AND lr.status = $${paramIdx++}`;
    params.push(filters.status);
  }

  if (filters.search) {
    queryStr += ` AND (emp.name ILIKE $${paramIdx} OR emp.email ILIKE $${paramIdx})`;
    params.push(`%${filters.search}%`);
    paramIdx++;
  }

  if (filters.month) {
    const [year, mon] = filters.month.split("-").map(Number);
    const startDate = `${filters.month}-01`;
    const endDate = mon === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
    queryStr += ` AND lr.start_date < $${paramIdx++} AND lr.end_date >= $${paramIdx++}`;
    params.push(endDate, startDate);
  }

  queryStr += ` ORDER BY lr.created_at DESC`;

  const { rows } = await query(queryStr, params);
  return rows;
};

// ─── Find by ID ───────────────────────────────────────────────────────────────
export const findById = async (id: string) => {
  const { rows } = await query(
    `SELECT lr.*, u.name AS employee_name
     FROM leave_requests lr
     LEFT JOIN users u ON u.entra_oid = lr.employee_oid
     WHERE lr.id = $1`,
    [id]
  );
  return rows[0] || null;
};

// ─── Approve (atomic: update request + deduct available_balance + log transaction) ─
export const approveRequest = async (
  id: string, actionedByOid: string, employeeOid: string,
  leaveType: string, totalDays: number, year: number
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: updatedRows } = await client.query(
      `WITH updated AS (
        UPDATE leave_requests
        SET status = 'approved', actioned_by_oid = $2, actioned_at = NOW(), updated_at = NOW()
        WHERE id = $1 RETURNING *
      )
      SELECT u.*, emp.name AS employee_name
      FROM updated u
      LEFT JOIN users emp ON emp.entra_oid = u.employee_oid`,
      [id, actionedByOid]
    );

    // Deduct from leave_balances for casual leave only (accrual-based)
    if (leaveType === "casual") {
      const { rows: balRows } = await client.query(
        `UPDATE leave_balances
         SET available_balance = GREATEST(available_balance - $1, 0),
             used_days = used_days + $1,
             remaining_days = GREATEST(remaining_days - $1, 0),
             updated_at = NOW()
         WHERE employee_oid = $2 AND leave_type = 'casual' AND year = $3
         RETURNING available_balance`,
        [totalDays, employeeOid, year]
      );
      const newBalance = Number(balRows[0]?.available_balance ?? 0);

      await client.query(
        `INSERT INTO leave_transactions
           (employee_oid, transaction_type, amount, balance_after, reason, leave_request_id, created_by)
         VALUES ($1, 'DEBIT', $2, $3, 'Approved casual leave deduction', $4, $5)`,
        [employeeOid, totalDays, newBalance, id, actionedByOid]
      );
    }

    await client.query("COMMIT");
    return updatedRows[0];
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ─── Reject ───────────────────────────────────────────────────────────────────
export const rejectRequest = async (id: string, actionedByOid: string, rejectionReason: string) => {
  const { rows } = await query(
    `WITH updated AS (
      UPDATE leave_requests
      SET status = 'rejected', actioned_by_oid = $2, actioned_at = NOW(),
          manager_comment = $3, updated_at = NOW()
      WHERE id = $1 RETURNING *
    )
    SELECT u.*, emp.name AS employee_name
    FROM updated u
    LEFT JOIN users emp ON emp.entra_oid = u.employee_oid`,
    [id, actionedByOid, rejectionReason]
  );
  return rows[0];
};

// ─── Cancel (employee) ────────────────────────────────────────────────────────
export const cancelRequest = async (id: string) => {
  const { rows } = await query(
    `UPDATE leave_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
};

// ─── Get paid leave balance (accrual-based) ───────────────────────────────────
export const getPaidLeaveBalance = async (employeeOid: string, year: number) => {
  const { rows } = await query(
    `SELECT lb.*, 
            COALESCE(
              (SELECT SUM(amount) FROM leave_transactions 
               WHERE employee_oid = $1 AND transaction_type = 'CREDIT'
               AND EXTRACT(YEAR FROM created_at) = $2), 0
            ) AS total_credited,
            COALESCE(
              (SELECT SUM(amount) FROM leave_transactions 
               WHERE employee_oid = $1 AND transaction_type = 'DEBIT'
               AND EXTRACT(YEAR FROM created_at) = $2), 0
            ) AS total_debited,
            COALESCE(
              (SELECT SUM(amount) FROM leave_transactions 
               WHERE employee_oid = $1 AND transaction_type = 'EXPIRE'
               AND EXTRACT(YEAR FROM created_at) = $2), 0
            ) AS total_expired,
            COALESCE(
              (SELECT SUM(amount) FROM leave_transactions 
               WHERE employee_oid = $1 AND transaction_type = 'ADJUSTMENT'
               AND EXTRACT(YEAR FROM created_at) = $2), 0
            ) AS total_adjusted
     FROM leave_balances lb
     WHERE lb.employee_oid = $1 AND lb.leave_type = 'casual' AND lb.year = $2`,
    [employeeOid, year]
  );
  return rows[0] || null;
};

// ─── Get leave transaction history ────────────────────────────────────────────
export const getTransactions = async (
  employeeOid: string,
  year?: number,
  type?: string,
  limit = 50,
  offset = 0
) => {
  let queryStr = `
    SELECT lt.*, lr.leave_type, lr.start_date, lr.end_date
    FROM leave_transactions lt
    LEFT JOIN leave_requests lr ON lr.id = lt.leave_request_id
    WHERE lt.employee_oid = $1
  `;
  const params: any[] = [employeeOid];
  let paramIdx = 2;

  if (year) {
    queryStr += ` AND EXTRACT(YEAR FROM lt.created_at) = $${paramIdx++}`;
    params.push(year);
  }

  if (type && type !== 'ALL') {
    queryStr += ` AND lt.transaction_type = $${paramIdx++}`;
    params.push(type);
  }

  queryStr += ` ORDER BY lt.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
  params.push(limit, offset);

  const { rows } = await query(queryStr, params);
  return rows;
};

// ─── HR/Admin: manual balance adjustment with transaction log ─────────────────
export const adjustBalance = async (
  employeeOid: string,
  amount: number,
  reason: string,
  performedByOid: string
) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const year = new Date().getFullYear();

    // Ensure balance row exists
    await client.query(`
      INSERT INTO leave_balances
        (employee_oid, leave_type, year, total_days, used_days, remaining_days, available_balance)
      VALUES ($1, 'casual', $2, 0, 0, 0, 0)
      ON CONFLICT (employee_oid, leave_type, year) DO NOTHING
    `, [employeeOid, year]);

    // Apply adjustment (can be positive or negative; clamp to >= 0)
    const { rows: balRows } = await client.query(`
      UPDATE leave_balances
      SET available_balance = GREATEST(available_balance + $1, 0),
          updated_at = NOW()
      WHERE employee_oid = $2 AND leave_type = 'casual' AND year = $3
      RETURNING available_balance
    `, [amount, employeeOid, year]);

    const newBalance = Number(balRows[0]?.available_balance ?? 0);

    // Record adjustment transaction (always positive amount)
    await client.query(`
      INSERT INTO leave_transactions
        (employee_oid, transaction_type, amount, balance_after, reason, created_by)
      VALUES ($1, 'ADJUSTMENT', $2, $3, $4, $5)
    `, [employeeOid, Math.abs(amount), newBalance, reason, performedByOid]);

    await client.query("COMMIT");
    return { newBalance, year };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ─── Check if employee has sufficient casual leave balance ─────────────────────
export const hasSufficientPaidLeave = async (
  employeeOid: string, daysRequested: number, year: number
): Promise<boolean> => {
  const bal = await getPaidLeaveBalance(employeeOid, year);
  if (!bal) return false;
  return Number(bal.available_balance) >= daysRequested;
};
