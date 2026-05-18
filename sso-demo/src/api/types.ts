export interface User {
  id: number;
  entra_oid: string;
  email: string;
  name: string;
  role?: string;
  designation?: string;
  manager_entra_oid: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category?: string | null;
  is_pinned: boolean;
  created_by_oid: string;
  created_at: string;
  updated_at: string;
  reactions: Record<string, number>;
  user_reaction?: string | null;
  comments_count?: number;
  image_url?: string;
  author_name?: string;
  status?: "draft" | "published";
  target_audience?: "ALL" | "HR" | "MANAGER" | "EMPLOYEE";
  is_archived?: boolean;
  archived_at?: string | null;
}

export interface TimesheetEntry {
  id: string;
  timesheet_week_id: string;
  work_date: string;
  project_name: string;
  task_description: string;
  hours: number;
  entry_type: "Work" | "Leave" | "Meeting";
  jira_task_id: string | null;
}

export interface Timesheet {
  id: string;
  employee_oid: string;
  employee_name?: string;
  week_start_date: string;
  status: "draft" | "submitted" | "reviewed" | "rejected";
  total_hours: number;
  submitted_at: string | null;
  reviewed_by_oid: string | null;
  reviewed_at: string | null;
  manager_comment: string | null;
  entries: TimesheetEntry[];
}

/** Lightweight summary row returned by GET /api/timesheets/history */
export interface TimesheetHistoryItem {
  id: string;
  week_start_date: string;
  total_hours: number;
  status: "draft" | "submitted" | "reviewed" | "rejected";
  submitted_at: string | null;
  reviewed_at: string | null;
  manager_comment: string | null;
  entries_count: number | string; // Postgres COUNT() returns string
}

export interface LeaveRequest {
  id: string;
  employee_oid: string;
  employee_name?: string;
  requester_name?: string;
  employee?: { name: string };
  manager_oid: string;
  leave_type: "annual" | "sick" | "casual" | "unpaid" | "other";
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  actioned_by_oid: string | null;
  actioned_at: string | null;
  manager_comment: string | null;
  created_at: string;
  // Medical certificate (Sick Leave only)
  medical_certificate_name?: string | null;
  medical_certificate_mime?: string | null;
  medical_certificate_data?: string | null;
}

export interface LeaveBalance {
  id: string;
  employee_oid: string;
  leave_type: string;
  year: number;
  total_days: number;
  used_days: number;
  remaining_days: number;
}

export interface HrDocument {
  id: string;
  title: string;
  description: string | null;
  document_type: string;
  onedrive_url: string;
  scope: "company" | "individual";
  department_name: string | null;
  assigned_to_oid: string | null;
  assigned_to_name?: string;
  assigned_to_email?: string;
  shared_by_name?: string;
  shared_by_email?: string;
  created_by_oid: string;
  created_at: string;
  updated_at: string;
}

export interface SearchResults {
  query: string;
  announcements: Array<{ id: string; title: string; type: string; subtitle: string }>;
  employees: Array<{ id: string; title: string; subtitle: string; type: string }>;
  documents: Array<{ id: string; title: string; subtitle: string; type: string }>;
  totalCount: number;
}

// ─── Holiday Calendar ─────────────────────────────────────────────────────────
export type HolidayType = 'mandatory' | 'optional' | 'festival' | 'regional' | 'company';
export type HolidayStatus = 'draft' | 'published' | 'archived';

export interface Holiday {
  id: string;
  title: string;
  description: string | null;
  holiday_type: HolidayType;
  start_date: string;
  end_date: string;
  is_optional: boolean;
  is_recurring: boolean;
  status: HolidayStatus;
  organization_id: string | null;
  branch_id: string | null;
  department_id: string | null;
  location_id: string | null;
  notify_employees: boolean;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HolidayStats {
  total_published: string;
  total_draft: string;
  total_archived: string;
  optional_count: string;
  regional_count: string;
  upcoming_count: string;
  upcoming_quarter_count: string;
  total_days: string;
  upcoming_days: string;
}

export interface HolidayFilters {
  year?: number;
  status?: HolidayStatus;
  holiday_type?: HolidayType;
  search?: string;
}

export interface HolidayImportResult {
  total: number;
  imported: number;
  errors: number;
  duplicates: number;
  results: Array<{ row: number; status: 'ok' | 'error' | 'duplicate'; data?: Holiday; error?: string }>;
  holidays: Holiday[];
}
