import { query } from "../../db";

export const searchAll = async (q: string, callerOid: string) => {
  const term = `%${q}%`;

  const [announcementsResult, employeesResult, documentsResult] = await Promise.all([
    query(
      `SELECT id, title, 'announcement' AS type, created_at AS subtitle
       FROM announcements
       WHERE title ILIKE $1 OR body ILIKE $1
       LIMIT 10`,
      [term]
    ),
    query(
      `SELECT id, name AS title, email AS subtitle, 'employee' AS type
       FROM users WHERE is_active = true AND (name ILIKE $1 OR email ILIKE $1)
       LIMIT 10`,
      [term]
    ),
    query(
      `SELECT id, title, document_type AS subtitle, 'document' AS type
       FROM hr_documents
       WHERE (scope = 'company' OR (scope = 'individual' AND assigned_to_oid = $2))
         AND (title ILIKE $1 OR document_type ILIKE $1)
       LIMIT 10`,
      [term, callerOid]
    ),
  ]);

  return {
    query: q,
    announcements: announcementsResult.rows,
    employees: employeesResult.rows,
    documents: documentsResult.rows,
    totalCount:
      announcementsResult.rows.length +
      employeesResult.rows.length +
      documentsResult.rows.length,
  };
};
