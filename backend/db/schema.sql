-- Updated DB Schema for SipraHub with MSAL Integration
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    entra_oid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    job_title VARCHAR(255),
    department VARCHAR(255),
    manager_id VARCHAR(255), -- references entra_oid of manager or internal id
    azure_groups JSONB DEFAULT '[]',
    app_roles JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);
