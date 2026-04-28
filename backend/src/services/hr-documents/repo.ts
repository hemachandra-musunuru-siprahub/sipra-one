import { query } from "../../db";

// ─── Scoped list (employee sees company + own individual) ─────────────────────
export const listDocuments = async (callerOid: string) => {
  const { rows } = await query(
    `SELECT * FROM hr_documents
     WHERE scope = 'company' OR (scope = 'individual' AND assigned_to_oid = $1)
     ORDER BY created_at DESC`,
    [callerOid]
  );
  return rows;
};

// ─── Find by ID (scoped) ──────────────────────────────────────────────────────
export const findById = async (id: string, callerOid: string) => {
  const { rows } = await query(
    `SELECT * FROM hr_documents
     WHERE id = $1 AND (scope = 'company' OR (scope = 'individual' AND assigned_to_oid = $2))`,
    [id, callerOid]
  );
  return rows[0] || null;
};

// ─── Find by ID (hr_admin — no scope filter) ──────────────────────────────────
export const findByIdAdmin = async (id: string) => {
  const { rows } = await query(`SELECT * FROM hr_documents WHERE id = $1`, [id]);
  return rows[0] || null;
};

// ─── Create ───────────────────────────────────────────────────────────────────
export const createDocument = async (
  title: string, documentType: string, scope: string,
  onedriveUrl: string, createdByOid: string,
  description?: string, assignedToOid?: string, departmentName?: string
) => {
  const { rows } = await query(
    `INSERT INTO hr_documents
       (title, description, document_type, onedrive_url, scope, assigned_to_oid, department_name, created_by_oid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [title, description || null, documentType, onedriveUrl, scope,
     assignedToOid || null, departmentName || null, createdByOid]
  );
  return rows[0];
};

// ─── Update ───────────────────────────────────────────────────────────────────
export const updateDocument = async (
  id: string,
  fields: { title?: string; description?: string; onedrive_url?: string; scope?: string; assigned_to_oid?: string }
) => {
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (fields.title            !== undefined) { sets.push(`title = $${i++}`);            vals.push(fields.title); }
  if (fields.description      !== undefined) { sets.push(`description = $${i++}`);      vals.push(fields.description); }
  if (fields.onedrive_url     !== undefined) { sets.push(`onedrive_url = $${i++}`);     vals.push(fields.onedrive_url); }
  if (fields.scope            !== undefined) { sets.push(`scope = $${i++}`);            vals.push(fields.scope); }
  if (fields.assigned_to_oid  !== undefined) { sets.push(`assigned_to_oid = $${i++}`); vals.push(fields.assigned_to_oid); }
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  const { rows } = await query(
    `UPDATE hr_documents SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`, vals
  );
  return rows[0] || null;
};

// ─── Delete ───────────────────────────────────────────────────────────────────
export const deleteDocument = async (id: string) => {
  const { rowCount } = await query(`DELETE FROM hr_documents WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
};
