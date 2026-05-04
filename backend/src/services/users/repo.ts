import { query } from "../../db";

// ─── List all users — identity profile only (no role columns) ─────────────────
export const listUsers = async () => {
  const { rows } = await query(`
    SELECT id, entra_oid, email, name, manager_entra_oid, is_active, created_at, last_login
    FROM users
    ORDER BY name ASC
  `);
  return rows;
};

// ─── Get single user by entra_oid ────────────────────────────────────────────
export const getUserByOid = async (entraOid: string) => {
  const { rows } = await query(
    `SELECT id, entra_oid, email, name, manager_entra_oid, is_active, created_at, last_login
     FROM users WHERE entra_oid = $1`,
    [entraOid]
  );
  return rows[0] || null;
};

// ─── Update manager mapping ───────────────────────────────────────────────────
export const updateManager = async (entraOid: string, managerEntraOid: string | null) => {
  const { rows } = await query(
    `UPDATE users SET manager_entra_oid = $2 WHERE entra_oid = $1
     RETURNING id, entra_oid, email, name, manager_entra_oid, is_active`,
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
