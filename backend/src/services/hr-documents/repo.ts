import { query } from "../../db";

// ─── Scoped list (employee sees company + own individual) ─────────────────────
export const listDocuments = async (callerOid: string) => {
  const { rows } = await query(
    `SELECT d.*, 
            d.visibility_scope AS scope,
            sharer.name AS shared_by_name,
            sharer.email AS shared_by_email,
            emp.name    AS assigned_to_name,
            emp.email   AS assigned_to_email
     FROM hr_documents d
     LEFT JOIN users sharer ON sharer.entra_oid = d.created_by_oid
     LEFT JOIN users emp    ON emp.entra_oid    = d.assigned_to_oid
     LEFT JOIN users caller ON caller.entra_oid = $1
     WHERE d.visibility_scope = 'company' 
        OR d.visibility_scope = 'organization'
        OR (d.visibility_scope = 'individual' AND (d.assigned_to_oid = $1 OR d.created_by_oid = $1))
        OR (d.department_name IS NOT NULL AND d.department_name = caller.department)
     ORDER BY d.created_at DESC`,
    [callerOid]
  );
  return rows;
};

// ─── HR/Admin sees all documents ever shared ──────────────────────────────────
export const listAllDocuments = async () => {
  const { rows } = await query(
    `SELECT d.*,
            d.visibility_scope AS scope,
            emp.name  AS assigned_to_name,
            emp.email AS assigned_to_email,
            sharer.name AS shared_by_name,
            sharer.email AS shared_by_email
     FROM hr_documents d
     LEFT JOIN users emp    ON emp.entra_oid    = d.assigned_to_oid
     LEFT JOIN users sharer ON sharer.entra_oid = d.created_by_oid
     ORDER BY d.created_at DESC`
  );
  return rows;
};

// ─── Find by ID (scoped) ──────────────────────────────────────────────────────
export const findById = async (id: string, callerOid: string) => {
  const { rows } = await query(
    `SELECT *, visibility_scope AS scope FROM hr_documents
     WHERE id = $1 AND (visibility_scope = 'company' OR visibility_scope = 'organization' OR (visibility_scope = 'individual' AND assigned_to_oid = $2))`,
    [id, callerOid]
  );
  return rows[0] || null;
};

// ─── Find by ID (hr_admin — no scope filter) ──────────────────────────────────
export const findByIdAdmin = async (id: string) => {
  const { rows } = await query(`SELECT *, visibility_scope AS scope FROM hr_documents WHERE id = $1`, [id]);
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
       (title, description, document_type, onedrive_url, visibility_scope, assigned_to_oid, department_name, created_by_oid)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *, visibility_scope AS scope`,
    [title, description || null, documentType, onedriveUrl, scope,
     assignedToOid || null, departmentName || null, createdByOid]
  );
  return rows[0];
};

// ─── Share document with multiple employees ───────────────────────────────────
// Creates one hr_document record per recipient for full tracking + scoping.
export const shareDocumentWithEmployees = async (
  fileName: string,
  documentType: string,
  onedriveUrl: string,
  sharedByOid: string,
  recipientOids: string[],
  description?: string
) => {
  const docs: any[] = [];
  for (const recipientOid of recipientOids) {
    const { rows } = await query(
      `INSERT INTO hr_documents
         (title, description, document_type, onedrive_url, visibility_scope, assigned_to_oid, created_by_oid)
       VALUES ($1,$2,$3,$4,'individual',$5,$6) RETURNING *, visibility_scope AS scope`,
      [fileName, description || null, documentType, onedriveUrl, recipientOid, sharedByOid]
    );
    docs.push(rows[0]);
  }
  return docs;
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
  if (fields.scope            !== undefined) { sets.push(`visibility_scope = $${i++}`); vals.push(fields.scope); }
  if (fields.assigned_to_oid  !== undefined) { sets.push(`assigned_to_oid = $${i++}`); vals.push(fields.assigned_to_oid); }
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  const { rows } = await query(
    `UPDATE hr_documents SET ${sets.join(", ")} WHERE id = $${i} RETURNING *, visibility_scope AS scope`, vals
  );
  return rows[0] || null;
};

// ─── Count (scoped) ───────────────────────────────────────────────────────────
export const countDocuments = async (callerOid: string) => {
  const { rows } = await query(
    `SELECT COUNT(*)::int FROM hr_documents
     WHERE visibility_scope = 'company' 
        OR visibility_scope = 'organization'
        OR (visibility_scope = 'individual' AND (assigned_to_oid = $1 OR created_by_oid = $1))`,
    [callerOid]
  );
  return rows[0].count;
};

// ─── Delete ───────────────────────────────────────────────────────────────────
export const deleteDocument = async (id: string) => {
  const { rowCount } = await query(`DELETE FROM hr_documents WHERE id = $1`, [id]);
  return (rowCount ?? 0) > 0;
};

