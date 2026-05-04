import { api } from "./client";
import type { Timesheet } from "./types";

export const getMyTimesheet = (week?: string) =>
  api.get<{ timesheet: Timesheet }>(
    `/api/timesheets${week ? `?week=${week}` : ""}`
  );

export const getTimesheetDetail = (id: string) =>
  api.get<{ timesheet: Timesheet }>(`/api/timesheets/${id}`);

export const getTeamTimesheets = (employeeId?: string, status?: string, search?: string) => {
  const params = new URLSearchParams();
  if (employeeId && employeeId !== "all") params.append("employeeId", employeeId);
  if (status     && status     !== "all") params.append("status",     status);
  if (search     && search.trim())        params.append("search",     search.trim());
  const qs = params.toString();
  return api.get<{ timesheets: Timesheet[] }>(`/api/timesheets/team${qs ? `?${qs}` : ""}`);
};

export const addEntry = (timesheetId: string, data: {
  workDate: string; projectName: string; taskDescription: string; hours: number;
}) => api.post<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/entries`, data);

export const updateEntry = (timesheetId: string, entryId: string, data: {
  workDate?: string; projectName?: string; taskDescription?: string; hours?: number;
}) => api.patch<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/entries/${entryId}`, data);

export const putUpdateEntry = (entryId: string, data: {
  date: string; project: string; task: string; hours: number;
}) => api.put<{ timesheet: Timesheet }>(`/api/timesheets/entries/${entryId}`, data);

export const deleteEntry = (timesheetId: string, entryId: string) =>
  api.delete<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/entries/${entryId}`);

export const submitTimesheet = (timesheetId: string) =>
  api.post<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/submit`, {});

export const reviewTimesheet = (timesheetId: string, status: "reviewed" | "draft", managerComment?: string) =>
  api.patch<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/status`, { status, managerComment });

/** Manager Excel export — uses authenticated session cookie, triggers file download */
export const exportManagerTimesheets = async (
  employeeId: string,
  month: string  // YYYY-MM
): Promise<void> => {
  const BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
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
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;

  // Try to get filename from Content-Disposition header
  const cd       = res.headers.get("Content-Disposition") || "";
  const match    = cd.match(/filename="?([^"]+)"?/);
  a.download     = match ? match[1] : `timesheets-reviewed-${month}.xlsx`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** HR/Admin CSV export — kept for HR dashboard use */
export const exportTimesheets = (startDate: string, endDate: string) => {
  const BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  window.open(`${BASE}/api/timesheets/export?startDate=${startDate}&endDate=${endDate}`, "_blank");
};
