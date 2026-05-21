import { api } from "./client";
import type { LeavePolicy, EmployeePolicyAssignment } from "./types";

// ─── Policy CRUD ──────────────────────────────────────────────────────────────
export const getLeavePolicies = () =>
  api.get<{ policies: LeavePolicy[] }>("/api/leave-policies");

export const createLeavePolicy = (data: {
  name: string;
  description?: string;
  leave_type: string;
  monthly_credit: number;
  carry_forward: boolean;
  expire_year_end: boolean;
}) => api.post<{ policy: LeavePolicy }>("/api/leave-policies", data);

export const updateLeavePolicy = (id: string, data: Partial<{
  name: string;
  description: string;
  monthly_credit: number;
  carry_forward: boolean;
  expire_year_end: boolean;
}>) => api.patch<{ policy: LeavePolicy }>(`/api/leave-policies/${id}`, data);

export const deleteLeavePolicy = (id: string) =>
  api.delete<{ message: string }>(`/api/leave-policies/${id}`);

// ─── Assignment ───────────────────────────────────────────────────────────────
export const assignPolicyToAll = (policyId: string) =>
  api.post<{ success: boolean; assigned: number; message: string }>(
    `/api/leave-policies/${policyId}/assign-all`, {}
  );

export const assignPolicyToEmployees = (policyId: string, employeeOids: string[]) =>
  api.post<{ success: boolean; assigned: number; message: string }>(
    `/api/leave-policies/${policyId}/assign`, { employeeOids }
  );

export const getPolicyAssignments = (policyId: string) =>
  api.get<{ assignments: EmployeePolicyAssignment[] }>(
    `/api/leave-policies/${policyId}/assignments`
  );

export const removeEmployeeFromPolicy = (policyId: string, employeeOid: string) =>
  api.delete<{ success: boolean }>(`/api/leave-policies/${policyId}/assign/${employeeOid}`);

// ─── Employee-level queries ───────────────────────────────────────────────────
export const getEmployeePolicyList = () =>
  api.get<{ employees: EmployeePolicyAssignment[] }>("/api/leave-policies/employees");

export const getPolicyForEmployee = (oid: string) =>
  api.get<{ policy: LeavePolicy | null }>(`/api/leave-policies/employee/${oid}`);

export const backfillEmployeeCredits = (oid: string) =>
  api.post<{
    success: boolean;
    employee: string;
    doj: string;
    credited: number;
    skipped: number;
    final_balance: number;
    details: string[];
    message: string;
  }>(`/api/leave-policies/backfill/${oid}`, {});

export const recalculateEmployeeCredits = (oid: string) =>
  api.post<{
    success: boolean;
    employee: string;
    doj: string;
    removed: number;
    removed_amount: number;
    credited: number;
    skipped: number;
    final_balance: number;
    details: string[];
    message: string;
  }>(`/api/leave-policies/recalculate/${oid}`, {});

