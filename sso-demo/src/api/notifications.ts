import { apiFetch } from "./client";

export interface Notification {
  id: string;
  recipient_oid: string;
  type: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

export const notificationsApi = {
  list: () =>
    apiFetch<NotificationsResponse>("/api/notifications"),

  markRead: (id: string) =>
    apiFetch<{ notification: Notification }>(`/api/notifications/${id}/read`, { method: "PATCH" }),

  markAllRead: () =>
    apiFetch<{ success: boolean }>("/api/notifications/read-all", { method: "PATCH" }),
};
