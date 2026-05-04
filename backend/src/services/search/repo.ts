import { query } from "../../db";

/**
 * searchAll
 * Performs parallel PostgreSQL full-text search across multiple categories.
 * Enforces strict visibility for HR documents.
 */
export const searchAll = async (q: string, userOid: string) => {
  // Use plainto_tsquery for natural language search compatibility
  // We'll also fall back to ILIKE if no matches found or for partial matches if needed,
  // but the prompt specifies tsvector + GIN.
  
  const [employees, announcements, hr_documents] = await Promise.all([
    // 1. Employees: Only active, match name or email
    query(
      `SELECT 
        entra_oid as id, 
        name as title, 
        email as subtitle, 
        'employee' as category,
        null as url
       FROM users 
       WHERE is_active = true 
         AND (
           to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(email, '')) @@ plainto_tsquery('simple', $1)
           OR name ILIKE $2
         )
       ORDER BY name ASC
       LIMIT 5`,
      [q, `%${q}%`]
    ),

    // 2. Announcements: Match title or body
    query(
      `SELECT 
        id::text, 
        title, 
        substring(body from 1 for 100) as subtitle, 
        'announcement' as category,
        '/announcements/' || id as url
       FROM announcements 
       WHERE 
         to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '')) @@ plainto_tsquery('english', $1)
         OR title ILIKE $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [q, `%${q}%`]
    ),

    // 3. HR Documents: Match title or type, enforce visibility
    // prompt says 'visibility' but schema uses 'scope'. We'll check both if needed, 
    // but schema has 'scope' with 'company', 'department', 'individual'.
    // We'll treat 'company' as public.
    query(
      `SELECT 
        id::text, 
        title, 
        document_type as subtitle, 
        'hr_document' as category,
        onedrive_url as url
       FROM hr_documents 
       WHERE (
         to_tsvector('english', coalesce(title, '') || ' ' || coalesce(document_type, '')) @@ plainto_tsquery('english', $1)
         OR title ILIKE $2
       )
       AND (
         scope = 'company' 
         OR scope = 'public' -- supporting user's prompt just in case
         OR assigned_to_oid = $3
       )
       LIMIT 5`,
      [q, `%${q}%`, userOid]
    )
  ]);

  return {
    employees: employees.rows,
    announcements: announcements.rows,
    hr_documents: hr_documents.rows
  };
};
