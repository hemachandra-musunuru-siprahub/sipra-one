import { api } from "./client";
import type { User } from "./types";

export const getUsers    = () => api.get<{ users: User[] }>("/api/users");
export const getUserById = (oid: string) => api.get<{ user: User }>(`/api/users/${oid}`);

/** Fetch only users with role='Manager' — used by the manager assignment picker. */
export const getManagers = (search?: string) =>
  api.get<{ managers: User[] }>(`/api/users/managers${search ? `?search=${encodeURIComponent(search)}` : ""}`);

export const setManager  = (oid: string, managerEntraOid: string | null) =>
  api.patch<{ user: User }>(`/api/users/${oid}/manager`, { managerEntraOid });
export const setActive   = (oid: string, isActive: boolean) =>
  api.patch<{ user: User }>(`/api/users/${oid}/active`, { isActive });

export const getTeamMembers = () => api.get<User[]>("/api/manager/team-members");

export const getDashboardSummary = () =>
  api.get<{ leaveBalances: any[]; counts: { documents: number; announcements: number } }>(
    "/api/employee/dashboard-summary"
  );
