export interface User {
  id: number;
  entra_oid: string;
  email: string;
  name: string;
  manager_entra_oid: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: string | null;
  is_pinned: boolean;
  created_by_oid: string;
  created_at: string;
  updated_at: string;
  reactions: Record<string, number>;
  user_reaction?: string | null;
  comments_count?: number;
  image_url?: string;
  type?: "GENERAL" | "IMPORTANT";
  author_name?: string;
}

export interface TimesheetEntry {
  id: string;
  timesheet_week_id: string;
  work_date: string;
  project_name: string;
  task_description: string;
  hours: number;
}

export interface Timesheet {
  id: string;
  employee_oid: string;
  employee_name?: string;
  week_start_date: string;
  status: "draft" | "submitted" | "reviewed";
  total_hours: number;
  submitted_at: string | null;
  reviewed_by_oid: string | null;
  reviewed_at: string | null;
  manager_comment: string | null;
  entries: TimesheetEntry[];
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
