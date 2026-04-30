import { api } from "./client";
import type { Announcement } from "./types";

export const getAnnouncements = (page = 1, limit = 20) =>
  api.get<{ announcements: Announcement[]; page: number; limit: number }>(
    `/api/announcements?page=${page}&limit=${limit}`
  );

export const getLatestAnnouncements = (limit = 3) =>
  api.get<{ announcements: Announcement[] }>(
    `/api/announcements?limit=${limit}&latest=true`
  );

export const createAnnouncement = (data: {
  title: string; body: string; category?: string; isPinned?: boolean;
}) => api.post<{ announcement: Announcement }>("/api/announcements", data);

export const updateAnnouncement = (id: string, data: {
  title?: string; body?: string; category?: string; is_pinned?: boolean;
}) => api.patch<{ announcement: Announcement }>(`/api/announcements/${id}`, data);

export const deleteAnnouncement = (id: string) => api.delete(`/api/announcements/${id}`);

export const reactToAnnouncement = (id: string, reactionType: string) =>
  api.post<{ reactions_count: Record<string, number>; user_reaction: string | null }>(
    `/api/announcements/${id}/reactions`, { reactionType }
  );

export const removeReaction = (id: string) =>
  api.delete<{ reactions_count: Record<string, number>; user_reaction: null }>(
    `/api/announcements/${id}/reactions`
  );
