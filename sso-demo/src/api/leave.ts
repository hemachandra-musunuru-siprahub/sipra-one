import { api } from "./client";
import type { LeaveRequest, LeaveTransaction, PaidLeaveBalance } from "./types";

export const getMyLeave = (month?: string) => {
  const url = month ? `/api/leave-requests?month=${month}` : "/api/leave-requests";
  return api.get<{ requests: LeaveRequest[] }>(url);
};

export const getTeamLeave = () =>
  api.get<{ requests: LeaveRequest[] }>("/api/leave-requests/team");

/**
 * HR/Admin: returns ALL leave requests (unfiltered).
 * Manager: returns only requests where manager_oid = caller's OID.
 */
export const getAllLeave = (month?: string, status?: string, search?: string) => {
  const params = new URLSearchParams();
  if (month) params.append("month", month);
  if (status) params.append("status", status);
  if (search) params.append("search", search);
  return api.get<{ requests: LeaveRequest[] }>(`/api/leave-requests/all?${params.toString()}`);
};

export const getManagerLeave = () =>
  api.get<{ requests: LeaveRequest[] }>("/api/leave-requests/manager");

// ─── Accrual-Based Paid Leave Balance ────────────────────────────────────────
export const getPaidLeaveBalance = (year?: number) =>
  api.get<{ balance: PaidLeaveBalance | null; year: number }>(
    `/api/leave-requests/paid-balance${year ? `?year=${year}` : ""}`
  );

export const getPaidLeaveBalanceForEmployee = (employeeOid: string, year?: number) =>
  api.get<{ balance: PaidLeaveBalance | null; year: number }>(
    `/api/leave-requests/paid-balance/${employeeOid}${year ? `?year=${year}` : ""}`
  );

// ─── Leave Transaction History ────────────────────────────────────────────────
export const getLeaveTransactions = (opts?: {
  year?: number;
  type?: string;
  limit?: number;
  offset?: number;
}) => {
  const params = new URLSearchParams();
  if (opts?.year)   params.append("year",   String(opts.year));
  if (opts?.type)   params.append("type",   opts.type);
  if (opts?.limit)  params.append("limit",  String(opts.limit));
  if (opts?.offset) params.append("offset", String(opts.offset));
  return api.get<{ transactions: LeaveTransaction[] }>(
    `/api/leave-requests/transactions?${params.toString()}`
  );
};

export const getLeaveTransactionsForEmployee = (
  employeeOid: string,
  opts?: { year?: number; type?: string; limit?: number; offset?: number }
) => {
  const params = new URLSearchParams();
  if (opts?.year)   params.append("year",   String(opts.year));
  if (opts?.type)   params.append("type",   opts.type);
  if (opts?.limit)  params.append("limit",  String(opts.limit));
  if (opts?.offset) params.append("offset", String(opts.offset));
  return api.get<{ transactions: LeaveTransaction[] }>(
    `/api/leave-requests/transactions/${employeeOid}?${params.toString()}`
  );
};

// ─── HR/Admin: Manual Adjustment ─────────────────────────────────────────────
export const adjustLeaveBalance = (
  employeeOid: string,
  data: { amount: number; reason: string }
) => api.post<{ success: boolean; newBalance: number; year: number }>(
  `/api/leave-requests/adjust/${employeeOid}`,
  data
);

// ─── Leave Application ────────────────────────────────────────────────────────
export const submitLeave = (data: {
  leaveType: "annual" | "sick" | "unpaid" | "other";
  startDate: string;
  endDate: string;
  reason?: string;
  medicalCertificateName?: string;
  medicalCertificateData?: string;
  medicalCertificateMime?: string;
}) => api.post<{ request: LeaveRequest }>("/api/leave-requests", data);

export const actionLeave = (
  id: string,
  action: "approved" | "rejected",
  rejectionReason?: string
) => api.patch<{ request: LeaveRequest }>(`/api/leave-requests/${id}`, { action, rejectionReason });

export const cancelLeave = (id: string) =>
  api.delete<{ request: LeaveRequest }>(`/api/leave-requests/${id}`);

// ─── Admin: Manual Cron Triggers ──────────────────────────────────────────────
export const triggerMonthlyCredit = () =>
  api.post<{ message: string }>("/api/leave-requests/jobs/monthly-credit", {});

export const triggerYearEndExpiry = () =>
  api.post<{ message: string }>("/api/leave-requests/jobs/year-end-expiry", {});
