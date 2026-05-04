import { api } from "./client";
import type { User } from "./types";

export const getUsers   = () => api.get<{ users: User[] }>("/api/users");
export const getUserById = (oid: string) => api.get<{ user: User }>(`/api/users/${oid}`);
export const setManager = (oid: string, managerEntraOid: string | null) =>
  api.patch<{ user: User }>(`/api/users/${oid}/manager`, { managerEntraOid });
export const setActive  = (oid: string, isActive: boolean) =>
  api.patch<{ user: User }>(`/api/users/${oid}/active`, { isActive });

export const getTeamMembers = () => api.get<User[]>("/api/manager/team-members");
