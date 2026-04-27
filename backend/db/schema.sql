-- Database schema for SipraHub MVP
-- Microsoft Entra ID is the source of truth for identity, roles, and authentication.
-- Local database stores business data and a lightweight user profile cache.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 0. User Profile Cache
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    entra_oid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255),
    department VARCHAR(255),
    manager_entra_oid VARCHAR(255),
    azure_groups JSONB DEFAULT '[]',
    app_roles JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE
);

-- ==========================================
-- 1. Announcements
-- ==========================================
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(100),
    is_pinned BOOLEAN DEFAULT false,
    created_by_oid VARCHAR(100) NOT NULL, -- Microsoft Entra OID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS announcement_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_oid VARCHAR(100) NOT NULL, -- Microsoft Entra OID
    reaction_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_announcement_user_reaction UNIQUE (announcement_id, user_oid, reaction_type)
);

-- ==========================================
-- 2. Timesheets
-- ==========================================
CREATE TABLE IF NOT EXISTS timesheet_weeks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_oid VARCHAR(100) NOT NULL,
    week_start_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, submitted, reviewed, rejected
    total_hours NUMERIC(5,2) DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE,
    reviewed_by_oid VARCHAR(100),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    manager_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_week UNIQUE (employee_oid, week_start_date)
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timesheet_week_id UUID NOT NULL REFERENCES timesheet_weeks(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    project_name VARCHAR(255) NOT NULL,
    task_description TEXT NOT NULL,
    hours NUMERIC(4,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 3. Leave Management
-- ==========================================
CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_oid VARCHAR(100) NOT NULL,
    manager_oid VARCHAR(100) NOT NULL,
    leave_type VARCHAR(50) NOT NULL, -- annual, sick, unpaid
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(4,1) NOT NULL,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, cancelled
    actioned_by_oid VARCHAR(100),
    actioned_at TIMESTAMP WITH TIME ZONE,
    manager_comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_oid VARCHAR(100) NOT NULL,
    leave_type VARCHAR(50) NOT NULL, -- annual, sick
    year INTEGER NOT NULL,
    total_days NUMERIC(4,1) NOT NULL,
    used_days NUMERIC(4,1) DEFAULT 0,
    remaining_days NUMERIC(4,1) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_employee_leave_year UNIQUE (employee_oid, leave_type, year)
);

-- ==========================================
-- 4. HR Documents
-- ==========================================
CREATE TABLE IF NOT EXISTS hr_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) NOT NULL,
    onedrive_url TEXT NOT NULL,
    scope VARCHAR(50) NOT NULL, -- company, department, individual
    department_name VARCHAR(100),
    assigned_to_oid VARCHAR(100),
    created_by_oid VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- 5. Audit Logs
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_oid VARCHAR(100) NOT NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- Indexes
-- ==========================================
-- User Cache Indexes
CREATE INDEX IF NOT EXISTS idx_users_entra_oid ON users(entra_oid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_manager_entra_oid ON users(manager_entra_oid);

-- Business Table Indexes
CREATE INDEX IF NOT EXISTS idx_announcements_created_by ON announcements(created_by_oid);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_ann_id ON announcement_reactions(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reactions_user ON announcement_reactions(user_oid);

CREATE INDEX IF NOT EXISTS idx_timesheet_weeks_employee ON timesheet_weeks(employee_oid);
CREATE INDEX IF NOT EXISTS idx_timesheet_weeks_start_date ON timesheet_weeks(week_start_date);
CREATE INDEX IF NOT EXISTS idx_timesheet_weeks_status ON timesheet_weeks(status);
CREATE INDEX IF NOT EXISTS idx_timesheet_entries_week_id ON timesheet_entries(timesheet_week_id);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_oid);
CREATE INDEX IF NOT EXISTS idx_leave_requests_manager ON leave_requests(manager_oid);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee ON leave_balances(employee_oid);

CREATE INDEX IF NOT EXISTS idx_hr_documents_created_by ON hr_documents(created_by_oid);
CREATE INDEX IF NOT EXISTS idx_hr_documents_assigned_to ON hr_documents(assigned_to_oid);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_oid);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ==========================================
-- Additional Performance Indexes
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at);
CREATE INDEX IF NOT EXISTS idx_leave_requests_created_at ON leave_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_hr_documents_scope ON hr_documents(scope);

-- ==========================================
-- Validation Constraints
-- ==========================================
-- Safe idempotent constraints: can rerun schema multiple times

ALTER TABLE timesheet_weeks
DROP CONSTRAINT IF EXISTS chk_timesheet_status;

ALTER TABLE timesheet_weeks
ADD CONSTRAINT chk_timesheet_status
CHECK (status IN ('draft', 'submitted', 'reviewed', 'rejected'));

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS chk_leave_status;

ALTER TABLE leave_requests
ADD CONSTRAINT chk_leave_status
CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS chk_leave_type;

ALTER TABLE leave_requests
ADD CONSTRAINT chk_leave_type
CHECK (leave_type IN ('annual', 'sick', 'unpaid'));

ALTER TABLE hr_documents
DROP CONSTRAINT IF EXISTS chk_hr_doc_scope;

ALTER TABLE hr_documents
ADD CONSTRAINT chk_hr_doc_scope
CHECK (scope IN ('company', 'department', 'individual'));
