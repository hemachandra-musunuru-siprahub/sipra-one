import { query } from "../../db";

// ─── List all users — for admin overview ─────────────────────────────────────
export const listUsers = async () => {
  const { rows } = await query(`
    SELECT 
      u.id, u.entra_oid, u.email, u.name, u.role,
      u.manager_entra_oid, 
      m.name AS manager_name, 
      m.email AS manager_email, 
      u.is_active, u.created_at, u.last_login
    FROM users u
    LEFT JOIN users m ON m.entra_oid = u.manager_entra_oid
    ORDER BY u.name ASC
  `);
  return rows;
};

// ─── List active Managers only — for the manager picker dropdown ──────────────
// Only users whose Entra-synced role is exactly 'Manager' are eligible.
export const listManagers = async (search?: string) => {
  if (search && search.trim()) {
    const { rows } = await query(
      `SELECT entra_oid, name, email, role
       FROM users
       WHERE is_active = true
         AND role = 'Manager'
         AND (name ILIKE $1 OR email ILIKE $1)
       ORDER BY name ASC`,
      [`%${search.trim()}%`]
    );
    return rows;
  }
  const { rows } = await query(
    `SELECT entra_oid, name, email, role
     FROM users
     WHERE is_active = true
       AND role = 'Manager'
     ORDER BY name ASC`
  );
  return rows;
};

// ─── Get single user by entra_oid ────────────────────────────────────────────
export const getUserByOid = async (entraOid: string) => {
  const { rows } = await query(
    `SELECT id, entra_oid, email, name, role, manager_entra_oid, is_active, created_at, last_login
     FROM users WHERE entra_oid = $1`,
    [entraOid]
  );
  return rows[0] || null;
};

// ─── Update manager mapping ───────────────────────────────────────────────────
export const updateManager = async (entraOid: string, managerEntraOid: string | null) => {
  const { rows } = await query(
    `WITH updated AS (
       UPDATE users SET manager_entra_oid = $2 WHERE entra_oid = $1
       RETURNING id, entra_oid, email, name, manager_entra_oid, is_active
     )
     SELECT u.*, m.name AS manager_name, m.email AS manager_email
     FROM updated u
     LEFT JOIN users m ON m.entra_oid = u.manager_entra_oid`,
    [entraOid, managerEntraOid]
  );
  return rows[0];
};

// ─── Toggle active state ──────────────────────────────────────────────────────
export const updateActiveState = async (entraOid: string, isActive: boolean) => {
  const { rows } = await query(
    `UPDATE users SET is_active = $2 WHERE entra_oid = $1
     RETURNING id, entra_oid, email, name, manager_entra_oid, is_active`,
    [entraOid, isActive]
  );
  return rows[0];
};

export const getDirectReportOids = async (managerOid: string): Promise<string[]> => {
  const { rows } = await query(
    `SELECT entra_oid FROM users WHERE manager_entra_oid = $1 AND is_active = true`,
    [managerOid]
  );
  return rows.map((r: any) => r.entra_oid);
};

export const getDirectReportsFull = async (managerOid: string) => {
  const { rows } = await query(
    `SELECT id, entra_oid, name, email FROM users WHERE manager_entra_oid = $1 AND is_active = true ORDER BY name ASC`,
    [managerOid]
  );
  return rows;
};
