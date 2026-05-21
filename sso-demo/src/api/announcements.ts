import { api } from "./client";
import type { SipraRequestInit } from "./client";
import type { Announcement } from "./types";

export const getAnnouncements = (page = 1, limit = 20, status = "published", init?: SipraRequestInit) =>
  api.get<{ announcements: Announcement[]; page: number; limit: number }>(
    `/api/announcements?page=${page}&limit=${limit}&status=${status}`,
    init
  );

export const getLatestAnnouncements = (limit = 3) =>
  api.get<{ announcements: Announcement[] }>(
    `/api/announcements?limit=${limit}&latest=true`
  );

export const createAnnouncement = (data: {
  title: string;
  body: string;
  isPinned?: boolean;
  status?: "draft" | "published";
  target_audience?: "ALL" | "HR" | "MANAGER" | "EMPLOYEE";
}) => api.post<{ announcement: Announcement }>("/api/announcements", data);

export const updateAnnouncement = (id: string, data: {
  title?: string;
  body?: string;
  is_pinned?: boolean;
  target_audience?: "ALL" | "HR" | "MANAGER" | "EMPLOYEE";
}) => api.patch<{ announcement: Announcement }>(`/api/announcements/${id}`, data);

export const deleteAnnouncement = (id: string) => api.delete(`/api/announcements/${id}`);

export const getArchivedAnnouncements = (page = 1, limit = 20, init?: SipraRequestInit) =>
  api.get<{ announcements: Announcement[]; page: number; limit: number }>(
    `/api/announcements/archived?page=${page}&limit=${limit}`,
    init
  );

export const archiveAnnouncement = (id: string) =>
  api.patch<{ announcement: Announcement }>(`/api/announcements/${id}/archive`, {});

export const unarchiveAnnouncement = (id: string) =>
  api.patch<{ announcement: Announcement }>(`/api/announcements/${id}/unarchive`, {});

export const reactToAnnouncement = (id: string, reactionType: string) =>
  api.post<{ reactions_count: Record<string, number>; user_reaction: string | null }>(
    `/api/announcements/${id}/reactions`, { reactionType }
  );

export const removeReaction = (id: string) =>
  api.delete<{ reactions_count: Record<string, number>; user_reaction: null }>(
    `/api/announcements/${id}/reactions`
  );
