import { query, pool } from "../../db";

// ─── Get all policies ─────────────────────────────────────────────────────────
export const getAllPolicies = async () => {
  const { rows } = await query(`
    SELECT lp.*,
           u.name AS created_by_name,
           COUNT(elp.id) FILTER (WHERE elp.is_active = true) AS assigned_count
    FROM leave_policies lp
    LEFT JOIN users u ON u.entra_oid = lp.created_by_oid
    LEFT JOIN employee_leave_policies elp ON elp.policy_id = lp.id
    WHERE lp.is_active = true
    GROUP BY lp.id, u.name
    ORDER BY lp.created_at DESC
  `);
  return rows;
};

// ─── Get policy by ID ─────────────────────────────────────────────────────────
export const getPolicyById = async (id: string) => {
  const { rows } = await query(
    `SELECT * FROM leave_policies WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

// ─── Create policy ────────────────────────────────────────────────────────────
export const createPolicy = async (data: {
  name: string;
  description?: string;
  leave_type: string;
  monthly_credit: number;
  carry_forward: boolean;
  expire_year_end: boolean;
  created_by_oid: string;
}) => {
  const { rows } = await query(
    `INSERT INTO leave_policies
       (name, description, leave_type, monthly_credit, carry_forward, expire_year_end, created_by_oid)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.name,
      data.description || null,
      data.leave_type,
      data.monthly_credit,
      data.carry_forward,
      data.expire_year_end,
      data.created_by_oid,
    ]
  );
  return rows[0];
};

// ─── Update policy ────────────────────────────────────────────────────────────
export const updatePolicy = async (
  id: string,
  data: Partial<{
    name: string;
    description: string;
    monthly_credit: number;
    carry_forward: boolean;
    expire_year_end: boolean;
  }>
) => {
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.name !== undefined)            { fields.push(`name = $${idx++}`);            values.push(data.name); }
  if (data.description !== undefined)     { fields.push(`description = $${idx++}`);     values.push(data.description); }
  if (data.monthly_credit !== undefined)  { fields.push(`monthly_credit = $${idx++}`);  values.push(data.monthly_credit); }
  if (data.carry_forward !== undefined)   { fields.push(`carry_forward = $${idx++}`);   values.push(data.carry_forward); }
  if (data.expire_year_end !== undefined) { fields.push(`expire_year_end = $${idx++}`); values.push(data.expire_year_end); }

  if (fields.length === 0) throw new Error("No fields to update");

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const { rows } = await query(
    `UPDATE leave_policies SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
    values
  );
  return rows[0];
};

// ─── Soft-delete policy ───────────────────────────────────────────────────────
export const deletePolicy = async (id: string) => {
  const { rows } = await query(
    `UPDATE leave_policies SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0];
};

// ─── Assign policy to all active non-Admin employees ─────────────────────────
export const assignPolicyToAll = async (policyId: string, assignedByOid: string) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Deactivate existing assignments for these employees first
    await client.query(`
      UPDATE employee_leave_policies
      SET is_active = false
      WHERE policy_id != $1
        AND employee_oid IN (
          SELECT entra_oid FROM users WHERE is_active = true AND role != 'Admin'
        )
    `, [policyId]);

    // Upsert new assignments
    const { rowCount } = await client.query(`
      INSERT INTO employee_leave_policies (employee_oid, policy_id, assigned_by)
      SELECT entra_oid, $1, $2
      FROM users
      WHERE is_active = true AND role != 'Admin'
      ON CONFLICT (employee_oid, policy_id)
      DO UPDATE SET is_active = true, assigned_by = $2, assigned_at = NOW()
    `, [policyId, assignedByOid]);

    await client.query("COMMIT");
    return rowCount ?? 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ─── Assign policy to specific employees ─────────────────────────────────────
export const assignPolicyToEmployees = async (
  policyId: string,
  employeeOids: string[],
  assignedByOid: string
) => {
  if (employeeOids.length === 0) return 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Deactivate any existing assignments for these employees (other policies)
    await client.query(`
      UPDATE employee_leave_policies
      SET is_active = false
      WHERE policy_id != $1
        AND employee_oid = ANY($2::text[])
    `, [policyId, employeeOids]);

    // Upsert this policy for each employee
    await client.query(`
      INSERT INTO employee_leave_policies (employee_oid, policy_id, assigned_by)
      SELECT unnest($1::text[]), $2, $3
      ON CONFLICT (employee_oid, policy_id)
      DO UPDATE SET is_active = true, assigned_by = $3, assigned_at = NOW()
    `, [employeeOids, policyId, assignedByOid]);

    await client.query("COMMIT");
    return employeeOids.length;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ─── Get employees assigned to a policy ──────────────────────────────────────
export const getAssignmentsForPolicy = async (policyId: string) => {
  const { rows } = await query(`
    SELECT elp.*, u.name AS employee_name, u.email AS employee_email, u.role,
           u.date_of_joining
    FROM employee_leave_policies elp
    JOIN users u ON u.entra_oid = elp.employee_oid
    WHERE elp.policy_id = $1 AND elp.is_active = true
    ORDER BY u.name ASC
  `, [policyId]);
  return rows;
};

// ─── Get active policy for a single employee ──────────────────────────────────
export const getActivePolicyForEmployee = async (employeeOid: string) => {
  const { rows } = await query(`
    SELECT lp.*, elp.assigned_at, elp.assigned_by
    FROM employee_leave_policies elp
    JOIN leave_policies lp ON lp.id = elp.policy_id
    WHERE elp.employee_oid = $1
      AND elp.is_active = true
      AND lp.is_active = true
    ORDER BY elp.assigned_at DESC
    LIMIT 1
  `, [employeeOid]);
  return rows[0] || null;
};

// ─── Remove a single employee from a policy ───────────────────────────────────
export const removeEmployeeFromPolicy = async (policyId: string, employeeOid: string) => {
  const { rows } = await query(`
    UPDATE employee_leave_policies
    SET is_active = false
    WHERE policy_id = $1 AND employee_oid = $2
    RETURNING *
  `, [policyId, employeeOid]);
  return rows[0];
};

// ─── Get all employees with their assigned policy (for HR overview) ────────────
export const getAllEmployeePolicies = async () => {
  const { rows } = await query(`
    SELECT
      u.entra_oid, u.name, u.email, u.role, u.date_of_joining,
      lp.id AS policy_id, lp.name AS policy_name,
      lp.monthly_credit, lp.leave_type,
      elp.assigned_at
    FROM users u
    LEFT JOIN employee_leave_policies elp
      ON elp.employee_oid = u.entra_oid AND elp.is_active = true
    LEFT JOIN leave_policies lp
      ON lp.id = elp.policy_id AND lp.is_active = true
    WHERE u.is_active = true AND u.role != 'Admin'
    ORDER BY u.name ASC
  `);
  return rows;
};
