import { useState, useEffect, useCallback } from "react";
import { socket } from "../lib/socket";
import { notificationsApi } from "../api/notifications";
import type { Notification } from "../api/notifications";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

interface UseNotificationsOptions {
  /** The authenticated user's Entra OID – used to join the private WS room */
  userOid: string | null;
}

export function useNotifications({ userOid }: UseNotificationsOptions) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // ── Fetch initial notifications from REST API ─────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!userOid) return;
    try {
      setIsLoading(true);
      const data = await notificationsApi.list();
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } catch (err) {
      console.error("[useNotifications] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userOid]);

  // ── Handle Socket.IO Listeners ───────────────────────────────────────────
  useEffect(() => {
    if (!userOid) return;

    // Update auth data - will be used if the socket reconnects automatically
    socket.auth = { oid: userOid };

    // Ensure we are connected
    if (!socket.connected) {
      socket.connect();
    } else {
      // If already connected, identify this session
      socket.emit("authenticate", userOid);
    }

    // Prevent duplicate listeners
    socket.off("notification");
    socket.off("unread_count");
    socket.off("connect");
    socket.off("disconnect");

    socket.on("connect", () => {
      console.log("[WS] Connected:", socket.id);
    });

    socket.on("notification", (notification: Notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    socket.on("unread_count", ({ count }: { count: number }) => {
      setUnreadCount(count);
    });

    socket.on("disconnect", (reason) => {
      console.log("[WS] Disconnected. Reason:", reason);
    });

    fetchNotifications();

    // No disconnect in cleanup as per requirements
    return () => {
      socket.off("notification");
      socket.off("unread_count");
      socket.off("connect");
      socket.off("disconnect");
    };
  }, [userOid, fetchNotifications]);

  // ── Mark single notification as read ─────────────────────────────────────
  const markRead = useCallback(async (id: string) => {
    try {
      const data = await notificationsApi.markRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount(data.notification ? Math.max(0, unreadCount - 1) : unreadCount);
    } catch (err) {
      console.error("[useNotifications] markRead error:", err);
    }
  }, [unreadCount]);

  // ── Mark all as read ──────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("[useNotifications] markAllRead error:", err);
    }
  }, []);

  return {
    notifications,
    unreadCount,
    isLoading,
    markRead,
    markAllRead,
    refetch: fetchNotifications,
  };
}
