import { query, pool } from "../../db";

// ─── Get own leave requests ───────────────────────────────────────────────────
export const getOwnRequests = async (employeeOid: string) => {
  const { rows } = await query(
    `SELECT lr.*, m.name AS manager_name
     FROM leave_requests lr
     LEFT JOIN users m ON m.entra_oid = lr.manager_oid
     WHERE lr.employee_oid = $1
     ORDER BY lr.created_at DESC`,
    [employeeOid]
  );
  return rows;
};

// ─── Create leave request ─────────────────────────────────────────────────────
export const createRequest = async (
  employeeOid: string, managerOid: string, leaveType: string,
  startDate: string, endDate: string, totalDays: number, reason?: string
) => {
  const { rows } = await query(
    `INSERT INTO leave_requests
       (employee_oid, manager_oid, leave_type, start_date, end_date, total_days, reason, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
    [employeeOid, managerOid, leaveType, startDate, endDate, totalDays, reason || null]
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
// Filters server-side: WHERE manager_oid = <logged-in OID>
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

// ─── Approve (atomic: update request + decrement balance) ─────────────────────
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
    // Decrement balance for managed leave types
    if (leaveType !== "other") {
      await client.query(
        `UPDATE leave_balances
         SET used_days = used_days + $1, remaining_days = remaining_days - $1, updated_at = NOW()
         WHERE employee_oid = $2 AND leave_type = $3 AND year = $4`,
        [totalDays, employeeOid, leaveType, year]
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

// ─── Get own balances ─────────────────────────────────────────────────────────
export const getBalances = async (employeeOid: string, year: number) => {
  const { rows } = await query(
    `SELECT * FROM leave_balances WHERE employee_oid = $1 AND year = $2`,
    [employeeOid, year]
  );
  return rows;
};

// ─── Get balance for specific type ────────────────────────────────────────────
export const getBalance = async (employeeOid: string, leaveType: string, year: number) => {
  const { rows } = await query(
    `SELECT * FROM leave_balances WHERE employee_oid = $1 AND leave_type = $2 AND year = $3`,
    [employeeOid, leaveType, year]
  );
  return rows[0] || null;
};

// ─── Set balance (hr_admin) ───────────────────────────────────────────────────
export const setBalance = async (
  employeeOid: string, leaveType: string, year: number, totalDays: number
) => {
  const { rows } = await query(
    `INSERT INTO leave_balances (employee_oid, leave_type, year, total_days, used_days, remaining_days)
     VALUES ($1,$2,$3,$4,0,$4)
     ON CONFLICT (employee_oid, leave_type, year)
     DO UPDATE SET total_days = $4, remaining_days = $4 - leave_balances.used_days, updated_at = NOW()
     RETURNING *`,
    [employeeOid, leaveType, year, totalDays]
  );
  return rows[0];
};
