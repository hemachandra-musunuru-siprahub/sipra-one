import { useRef, useState, useEffect } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Notification } from "../api/notifications";

// ── Type icon mapping ─────────────────────────────────────────────────────────
const TYPE_META: Record<string, { icon: string; color: string }> = {
  leave_request:  { icon: "📅", color: "#3b82f6" },
  leave_approved: { icon: "✅", color: "#22c55e" },
  leave_rejected: { icon: "❌", color: "#ef4444" },
  announcement:   { icon: "📢", color: "#f59e0b" },
  hr_document:    { icon: "📄", color: "#8b5cf6" },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  role?: string;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

export function NotificationBell({
  notifications,
  unreadCount,
  isLoading,
  role = "Employee",
  onMarkRead,
  onMarkAllRead,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleToggle = () => setIsOpen(prev => !prev);

  const handleMarkRead = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onMarkRead(id);
  };

  const handleNotificationClick = (e: React.MouseEvent, notif: Notification) => {
    e.stopPropagation();
    if (!notif.is_read) {
      onMarkRead(notif.id);
    }
    setIsOpen(false);
    
    let path = "/";
    const r = role.toLowerCase();

    if (notif.type === "leave_request") {
      if (r === "manager") path = "/manager/leave-approvals";
      else if (r === "hr" || r === "admin") path = "/hr/leave-management";
      else path = "/employee/leave"; // fallback
    } else if (notif.type === "leave_approved" || notif.type === "leave_rejected") {
      if (r === "manager") path = "/manager/my-leave";
      else if (r === "hr" || r === "admin") path = "/hr/my-leave";
      else path = "/employee/leave";
    } else if (notif.type === "announcement") {
      path = `/announcements/${notif.entity_id || ""}`;
    } else if (notif.type === "hr_document") {
      if (r === "manager") path = "/manager/documents";
      else if (r === "hr" || r === "admin") path = "/hr/documents";
      else path = "/employee/documents";
    }

    navigate(path);
  };

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* ── Bell Button ───────────────────────────────────────────────── */}
      <button
        id="notification-bell-btn"
        className="topbar__icon-btn"
        aria-label={`Notifications – ${unreadCount} unread`}
        onClick={handleToggle}
        style={{ position: "relative" }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            id="notif-badge"
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              minWidth: "18px",
              height: "18px",
              borderRadius: "9px",
              background: "var(--error, #ef4444)",
              color: "#fff",
              fontSize: "10px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: "2px solid var(--sidebar-bg, #1a1a2e)",
              lineHeight: 1,
              pointerEvents: "none",
              animation: unreadCount > 0 ? "notif-pulse 2s ease infinite" : "none",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown Panel ────────────────────────────────────────────── */}
      {isOpen && (
        <div
          id="notification-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: "360px",
            maxHeight: "480px",
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: "12px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "notif-drop 0.18s ease",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px 12px",
              borderBottom: "1px solid var(--border, #e5e7eb)",
              background: "var(--surface-raised, #f9fafb)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Bell size={16} color="var(--primary-500, #e53e3e)" />
              <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary, #111)" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "var(--error, #ef4444)",
                    color: "#fff",
                    borderRadius: "10px",
                    padding: "1px 7px",
                    fontSize: "11px",
                    fontWeight: 700,
                  }}
                >
                  {unreadCount} new
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {unreadCount > 0 && (
                <button
                  id="mark-all-read-btn"
                  onClick={onMarkAllRead}
                  title="Mark all as read"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-secondary, #6b7280)",
                    padding: "4px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.15s, background 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--hover-bg, #f3f4f6)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <CheckCheck size={16} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-secondary, #6b7280)",
                  padding: "4px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {isLoading && (
              <div style={{ padding: "32px", textAlign: "center", color: "var(--text-secondary, #6b7280)", fontSize: "13px" }}>
                Loading notifications…
              </div>
            )}
            {!isLoading && notifications.length === 0 && (
              <div
                style={{
                  padding: "48px 24px",
                  textAlign: "center",
                  color: "var(--text-secondary, #6b7280)",
                  fontSize: "13px",
                }}
              >
                <Bell size={32} style={{ opacity: 0.25, marginBottom: "8px", display: "block", margin: "0 auto 8px" }} />
                <div>You're all caught up!</div>
              </div>
            )}
            {!isLoading &&
              notifications.map(notif => {
                const meta = TYPE_META[notif.type] ?? { icon: "🔔", color: "#6b7280" };
                return (
                  <div
                    key={notif.id}
                    id={`notif-item-${notif.id}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "12px 16px",
                      background: notif.is_read ? "transparent" : "rgba(59,130,246,0.05)",
                      borderBottom: "1px solid var(--border, #f0f0f0)",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      position: "relative",
                    }}
                    onClick={(e) => handleNotificationClick(e, notif)}
                    onMouseEnter={e => { 
                      (e.currentTarget as HTMLElement).style.background = notif.is_read ? "var(--hover-bg, #f9fafb)" : "rgba(59,130,246,0.08)"; 
                    }}
                    onMouseLeave={e => { 
                      (e.currentTarget as HTMLElement).style.background = notif.is_read ? "transparent" : "rgba(59,130,246,0.05)"; 
                    }}
                  >
                    {/* Icon */}
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "50%",
                        background: `${meta.color}18`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        flexShrink: 0,
                        marginTop: "1px",
                      }}
                    >
                      {meta.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: notif.is_read ? 400 : 600,
                          fontSize: "13px",
                          color: "var(--text-primary, #111)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {notif.title}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--text-secondary, #6b7280)",
                          marginTop: "2px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {notif.message}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-tertiary, #9ca3af)", marginTop: "4px" }}>
                        {relativeTime(notif.created_at)}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!notif.is_read && (
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "var(--primary-500, #e53e3e)",
                          flexShrink: 0,
                          marginTop: "4px",
                        }}
                      />
                    )}
                  </div>
                );
              })}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              style={{
                padding: "10px 16px",
                borderTop: "1px solid var(--border, #e5e7eb)",
                textAlign: "center",
                background: "var(--surface-raised, #f9fafb)",
              }}
            >
              <span style={{ fontSize: "12px", color: "var(--text-secondary, #6b7280)" }}>
                Showing last {notifications.length} notifications
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes notif-pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.15); }
        }
        @keyframes notif-drop {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
