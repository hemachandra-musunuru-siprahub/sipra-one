import { api } from "./client";
import type { Timesheet, TimesheetHistoryItem } from "./types";


/** Employee's own full history — no entries payload, lightweight */
export const getMyTimesheetHistory = (options?: {
  status?: string;
  month?: string;
}): Promise<{ timesheets: TimesheetHistoryItem[] }> => {
  const params = new URLSearchParams();
  if (options?.status && options.status !== "all") params.append("status", options.status);
  if (options?.month) params.append("month", options.month);
  const qs = params.toString();
  return api.get(`/api/timesheets/history${qs ? `?${qs}` : ""}`);
};

export const getMyTimesheet = (week?: string) =>
  api.get<{ timesheet: Timesheet }>(
    `/api/timesheets${week ? `?week=${week}` : ""}`
  );

export const getTimesheetDetail = (id: string) =>
  api.get<{ timesheet: Timesheet }>(`/api/timesheets/${id}`);

export const getTeamTimesheets = (employeeId?: string, status?: string, search?: string, month?: string) => {
  const params = new URLSearchParams();
  if (employeeId && employeeId !== "all") params.append("employeeId", employeeId);
  if (status && status !== "all") params.append("status", status);
  if (search && search.trim()) params.append("search", search.trim());
  if (month && month !== "all") params.append("month", month);
  const qs = params.toString();
  return api.get<{ timesheets: Timesheet[] }>(`/api/timesheets/team${qs ? `?${qs}` : ""}`);
};

export const addEntry = (timesheetId: string, data: {
  workDate: string;
  projectName?: string;
  taskDescription: string;
  hours: number;
  entryType?: string;
  jiraTaskId?: string | null;
}) => api.post<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/entries`, data);

export const updateEntry = (timesheetId: string, entryId: string, data: {
  workDate?: string;
  projectName?: string;
  taskDescription?: string;
  hours?: number;
  entryType?: string;
  jiraTaskId?: string | null;
}) => api.patch<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/entries/${entryId}`, data);

export const putUpdateEntry = (entryId: string, data: {
  date: string;
  project?: string;
  task: string;
  hours: number;
  entryType?: string;
  jiraTaskId?: string | null;
}) => api.put<{ timesheet: Timesheet }>(`/api/timesheets/entries/${entryId}`, data);

export const deleteEntry = (timesheetId: string, entryId: string) =>
  api.delete<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/entries/${entryId}`);

export const submitTimesheet = (timesheetId: string) =>
  api.post<{ timesheet: Timesheet; autoApproved?: boolean }>(`/api/timesheets/${timesheetId}/submit`, {});

export const reviewTimesheet = (timesheetId: string, status: "reviewed" | "draft" | "rejected", managerComment?: string) =>
  api.patch<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/status`, { status, managerComment });

/** Manager Excel export — uses authenticated session cookie, triggers file download */
export const exportManagerTimesheets = async (
  employeeId: string,
  month: string  // YYYY-MM
): Promise<void> => {
  const BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const params = new URLSearchParams({ month });
  if (employeeId && employeeId !== "all") params.append("employeeId", employeeId);

  const res = await fetch(`${BASE}/api/timesheets/manager-export?${params}`, {
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Export failed: ${res.statusText}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  // Try to get filename from Content-Disposition header
  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/);
  a.download = match ? match[1] : `timesheets-reviewed-${month}.xlsx`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** HR/Admin CSV export — kept for HR dashboard use */
export const exportTimesheets = (startDate: string, endDate: string) => {
  const BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  window.open(`${BASE}/api/timesheets/export?startDate=${startDate}&endDate=${endDate}`, "_blank");
};

/** HR view — all timesheets across all employees with optional filters */
export const getHRTimesheets = (options?: {
  employeeOid?: string;
  status?: string;
  month?: string;  // YYYY-MM
}) => {
  const params = new URLSearchParams();
  if (options?.employeeOid && options.employeeOid !== "all") params.append("employeeOid", options.employeeOid);
  if (options?.status && options.status !== "all") params.append("status", options.status);
  if (options?.month) params.append("month", options.month);
  const qs = params.toString();
  return api.get<{ timesheets: HRTimesheet[] }>(`/api/timesheets/hr${qs ? `?${qs}` : ""}`);
};

/** HR Excel export — triggers a file download from /api/timesheets/export with all filters */
export const exportHRTimesheets = async (options?: {
  employeeOid?: string;
  status?: string;
  month?: string;
}): Promise<void> => {
  const BASE = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
  const params = new URLSearchParams();
  if (options?.employeeOid && options.employeeOid !== "all") params.append("employeeOid", options.employeeOid);
  if (options?.status && options.status !== "all") params.append("status", options.status);
  if (options?.month) params.append("month", options.month);

  const res = await fetch(`${BASE}/api/timesheets/export?${params}`, {
    credentials: "include",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Export failed: ${res.statusText}`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;

  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/);
  a.download = match ? match[1] : `hr-timesheets-export-${options?.month || "all"}.xlsx`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** HR Timesheet record returned from /api/timesheets/hr */
export interface HRTimesheet {
  id: string;
  employee_oid: string;
  employee_name: string | null;
  employee_email: string | null;
  week_start_date: string;
  total_hours: number;
  status: "draft" | "submitted" | "reviewed";
  submitted_at: string | null;
  reviewed_at: string | null;
}
