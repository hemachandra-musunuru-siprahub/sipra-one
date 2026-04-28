import { api } from "./client";
import type { Timesheet } from "./types";

export const getMyTimesheet = (week?: string) =>
  api.get<{ timesheet: Timesheet }>(
    `/api/timesheets${week ? `?week=${week}` : ""}`
  );

export const getTeamTimesheets = () =>
  api.get<{ timesheets: Timesheet[] }>("/api/timesheets/team");

export const addEntry = (timesheetId: string, data: {
  workDate: string; projectName: string; taskDescription: string; hours: number;
}) => api.post<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/entries`, data);

export const updateEntry = (timesheetId: string, entryId: string, data: {
  workDate?: string; projectName?: string; taskDescription?: string; hours?: number;
}) => api.patch<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/entries/${entryId}`, data);

export const deleteEntry = (timesheetId: string, entryId: string) =>
  api.delete<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/entries/${entryId}`);

export const submitTimesheet = (timesheetId: string) =>
  api.post<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/submit`, {});

export const reviewTimesheet = (timesheetId: string, status: "reviewed" | "draft", managerComment?: string) =>
  api.patch<{ timesheet: Timesheet }>(`/api/timesheets/${timesheetId}/status`, { status, managerComment });

export const exportTimesheets = (startDate: string, endDate: string) => {
  const BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  window.open(`${BASE}/api/timesheets/export?startDate=${startDate}&endDate=${endDate}`, "_blank");
};
