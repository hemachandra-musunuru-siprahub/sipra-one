import { api, apiFetch } from "./client";
import type { Holiday, HolidayFilters, HolidayImportResult, HolidayStats } from "./types";

const BASE = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

export interface HolidaysResponse {
  holidays: Holiday[];
  stats?: HolidayStats;
}

export const getHolidays = (filters?: HolidayFilters): Promise<HolidaysResponse> => {
  const params = new URLSearchParams();
  if (filters?.year)         params.set("year", String(filters.year));
  if (filters?.status)       params.set("status", filters.status);
  if (filters?.holiday_type) params.set("holiday_type", filters.holiday_type);
  if (filters?.search)       params.set("search", filters.search);
  const qs = params.toString();
  return api.get<HolidaysResponse>(`/api/holidays${qs ? `?${qs}` : ""}`);
};

export const getHoliday = (id: string): Promise<{ holiday: Holiday }> =>
  api.get<{ holiday: Holiday }>(`/api/holidays/${id}`);

export const createHoliday = (data: Partial<Holiday>): Promise<{ holiday: Holiday }> =>
  api.post<{ holiday: Holiday }>("/api/holidays", data);

export const updateHoliday = (id: string, data: Partial<Holiday>): Promise<{ holiday: Holiday }> =>
  api.put<{ holiday: Holiday }>(`/api/holidays/${id}`, data);

export const updateHolidayStatus = (id: string, status: Holiday["status"]): Promise<{ holiday: Holiday }> =>
  api.patch<{ holiday: Holiday }>(`/api/holidays/${id}/status`, { status });

export const duplicateHoliday = (id: string): Promise<{ holiday: Holiday }> =>
  api.post<{ holiday: Holiday }>(`/api/holidays/${id}/duplicate`, {});

export const deleteHoliday = (id: string): Promise<void> =>
  api.delete<void>(`/api/holidays/${id}`);

export const bulkPublish = (ids: string[], status: Holiday["status"] = "published"): Promise<{ updated: number; holidays: Holiday[] }> =>
  api.post<{ updated: number; holidays: Holiday[] }>("/api/holidays/bulk-publish", { ids, status });

export const importHolidays = async (file: File, publish = false): Promise<HolidayImportResult> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("publish", String(publish));
  const res = await fetch(`${BASE}/api/holidays/import`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || "Import failed");
  }
  return res.json();
};

export const exportHolidays = (format: "xlsx" | "csv", filters?: HolidayFilters): void => {
  const params = new URLSearchParams({ format });
  if (filters?.year)         params.set("year", String(filters.year));
  if (filters?.status)       params.set("status", filters.status);
  if (filters?.holiday_type) params.set("holiday_type", filters.holiday_type);
  window.open(`${BASE}/api/holidays/export?${params.toString()}`, "_blank");
};

export * from "./holidayAnalytics";

// ─── UI Constants ──────────────────────────────────────────────────
export const HOLIDAY_TYPE_LABELS: Record<string, string> = {
  mandatory: "Mandatory",
  optional:  "Optional",
  festival:  "Festival",
  regional:  "Regional",
  company:   "Company",
};

export const HOLIDAY_TYPE_COLORS: Record<string, string> = {
  mandatory: "#CE2124",
  optional:  "#3B82F6",
  festival:  "#F97316",
  regional:  "#8B5CF6",
  company:   "#10B981",
};

export const HOLIDAY_TYPE_BG: Record<string, string> = {
  mandatory: "rgba(206,33,36,0.12)",
  optional:  "rgba(59,130,246,0.12)",
  festival:  "rgba(249,115,22,0.12)",
  regional:  "rgba(139,92,246,0.12)",
  company:   "rgba(16,185,129,0.12)",
};

/** Returns all dates (as YYYY-MM-DD strings) between start and end (inclusive) */
export const getDatesInRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  const cur = new Date(`${start.slice(0, 10)}T12:00:00Z`);
  const last = new Date(`${end.slice(0, 10)}T12:00:00Z`);
  
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
};
