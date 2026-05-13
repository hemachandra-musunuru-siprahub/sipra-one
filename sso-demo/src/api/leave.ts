import { api } from "./client";
import type { LeaveRequest, LeaveBalance } from "./types";

export const getMyLeave = (month?: string) => {
  const url = month ? `/api/leave-requests?month=${month}` : "/api/leave-requests";
  return api.get<{ requests: LeaveRequest[] }>(url);
};

export const getTeamLeave = () =>
  api.get<{ requests: LeaveRequest[] }>("/api/leave-requests/team");

/**
 * HR/Admin: returns ALL leave requests (unfiltered).
 * Manager: returns only requests where manager_oid = caller's OID.
 * Filtering is server-side; no params needed.
 */
export const getAllLeave = (month?: string, status?: string, search?: string) => {
  const params = new URLSearchParams();
  if (month) params.append("month", month);
  if (status) params.append("status", status);
  if (search) params.append("search", search);
  return api.get<{ requests: LeaveRequest[] }>(`/api/leave-requests/all?${params.toString()}`);
};

/**
 * Explicit manager-scoped endpoint: requests where manager_oid = caller.
 * Prefer getAllLeave() from the HR/Manager pages — it auto-branches by role.
 */
export const getManagerLeave = () =>
  api.get<{ requests: LeaveRequest[] }>("/api/leave-requests/manager");

export const getLeaveBalances = (year?: number) =>
  api.get<{ balances: LeaveBalance[]; year: number }>(
    `/api/leave-requests/balances${year ? `?year=${year}` : ""}`
  );

export const submitLeave = (data: {
  leaveType: "annual" | "sick" | "unpaid" | "other";
  startDate: string;
  endDate: string;
  reason?: string;
}) => api.post<{ request: LeaveRequest }>("/api/leave-requests", data);

export const actionLeave = (
  id: string,
  action: "approved" | "rejected",
  rejectionReason?: string
) => api.patch<{ request: LeaveRequest }>(`/api/leave-requests/${id}`, { action, rejectionReason });

export const cancelLeave = (id: string) =>
  api.delete<{ request: LeaveRequest }>(`/api/leave-requests/${id}`);

export const setLeaveBalance = (
  employeeOid: string,
  data: { leaveType: "annual" | "sick" | "unpaid" | "other"; year: number; totalDays: number }
) => api.patch<{ balance: LeaveBalance }>(`/api/leave-requests/balances/${employeeOid}`, data);

export interface LeavePolicy {
  id: string;
  name: string;
  leave_type: "annual" | "sick" | "casual" | "unpaid" | "other";
  total_days: number;
  scope: "all" | "department" | "individual";
  target?: string;
  created_at: string;
}

export const getPolicies = () =>
  api.get<{ policies: LeavePolicy[] }>("/api/leave-requests/policies");

export const createPolicy = (data: {
  name: string;
  leaveType: "annual" | "sick" | "casual" | "unpaid" | "other";
  totalDays: number;
  scope: "all" | "department" | "individual";
  target?: string | null;
}) => api.post<{ policy: LeavePolicy }>("/api/leave-requests/policies", data);
