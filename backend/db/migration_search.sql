-- migration.sql
-- Safe migration to add GIN indexes for high-performance global search

-- 1. Announcements: search across title and body
CREATE INDEX IF NOT EXISTS idx_announcements_search_gin ON announcements 
USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, '')));

-- 2. Employees (users): search across name and email (using simple for emails/names)
CREATE INDEX IF NOT EXISTS idx_users_search_gin ON users 
USING GIN (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(email, '')))
WHERE is_active = true;

-- 3. HR Documents: search across title and document_type
CREATE INDEX IF NOT EXISTS idx_hr_documents_search_gin ON hr_documents 
USING GIN (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(document_type, '')));
