import { api } from "./client";
import type { LeaveRequest, LeaveBalance } from "./types";

export const getMyLeave = () =>
  api.get<{ requests: LeaveRequest[] }>("/api/leave-requests");

export const getTeamLeave = () =>
  api.get<{ requests: LeaveRequest[] }>("/api/leave-requests/team");

export const getAllLeave = () =>
  api.get<{ requests: LeaveRequest[] }>("/api/leave-requests/all");

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
