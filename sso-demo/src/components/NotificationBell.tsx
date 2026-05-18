import { useRef, useState, useEffect } from "react";
import { Bell, CheckCheck, X, Megaphone, Info, Calendar, FileText, CheckCircle2, AlertCircle, Clock, ClipboardList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Notification } from "../api/notifications";

// ── Type icon mapping ─────────────────────────────────────────────────────────
const TYPE_META: Record<string, { icon: React.ReactNode; color: string }> = {
  leave_request: { icon: <Calendar size={14} />, color: "#3b82f6" },
  leave_approved: { icon: <CheckCircle2 size={14} />, color: "#10b981" },
  leave_rejected: { icon: <AlertCircle size={14} />, color: "#ef4444" },
  announcement: { icon: <Megaphone size={14} />, color: "#f59e0b" },
  hr_document: { icon: <FileText size={14} />, color: "#8b5cf6" },
  timesheet_reminder: { icon: <Clock size={14} />, color: "#3b82f6" },
  timesheet_manager_summary: { icon: <ClipboardList size={14} />, color: "#10b981" },
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
  const [isExpanded, setIsExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const INITIAL_LIMIT = 2;
  const hasMore = notifications.length > INITIAL_LIMIT;
  const visibleNotifications = isExpanded ? notifications : notifications.slice(0, INITIAL_LIMIT);

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

  // Reset expansion state when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      // Small delay to prevent flickering during close animation
      const timer = setTimeout(() => setIsExpanded(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleToggle = () => setIsOpen(prev => !prev);

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
      else if (r === "hr" || r === "admin") path = "/hr/leave-requests";
      else path = "/employee/leave";
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
    } else if (notif.type === "timesheet_reminder") {
      if (r === "hr") path = "/hr/my-timesheet";
      else if (r === "manager") path = "/manager/my-timesheet";
      else path = "/employee/timesheets";
    } else if (notif.type === "timesheet_manager_summary") {
      if (r === "hr") path = "/hr/timesheets";
      else if (r === "manager") path = "/manager/timesheets";
      else path = "/employee/timesheets";
    }

    navigate(path);
  };

  return (
    <div ref={panelRef} className="notif-bell-container" style={{ position: "relative" }}>
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
            className="notif-badge"
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              minWidth: "14px",
              height: "14px",
              borderRadius: "7px",
              background: "#ef4444",
              color: "#fff",
              fontSize: "9px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              border: "1.5px solid var(--topbar-bg, #fff)",
              lineHeight: 1,
              pointerEvents: "none",
              zIndex: 1,
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
          className="notif-dropdown"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: "330px",
            maxWidth: "90vw",
            maxHeight: isExpanded ? "480px" : "280px",
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            transition: "max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            animation: "notif-drop 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div
            className="notif-header"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderBottom: "1px solid #f1f5f9",
              background: "#fff",
              position: "sticky",
              top: 0,
              zIndex: 2,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontWeight: 600, fontSize: "13px", color: "#0f172a" }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    background: "#fecaca",
                    color: "#dc2626",
                    borderRadius: "3px",
                    padding: "0 5px",
                    fontSize: "10px",
                    fontWeight: 600,
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "2px" }}>
              {unreadCount > 0 && (
                <button
                  id="mark-all-read-btn"
                  onClick={(e) => { e.stopPropagation(); onMarkAllRead(); }}
                  title="Mark all as read"
                  className="notif-action-btn"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                    padding: "4px",
                    borderRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <CheckCheck size={14} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="notif-action-btn"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                  padding: "4px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="notif-list" style={{ overflowY: isExpanded ? "auto" : "hidden", flex: 1, position: "relative" }}>
            {isLoading && (
              <div style={{ padding: "24px", textAlign: "center", color: "#64748b", fontSize: "12px" }}>
                <div className="notif-spinner" />
                Loading...
              </div>
            )}
            {!isLoading && notifications.length === 0 && (
              <div
                style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  color: "#94a3b8",
                }}
              >
                <div style={{
                  width: "36px",
                  height: "36px",
                  background: "#f8fafc",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 10px"
                }}>
                  <Bell size={16} />
                </div>
                <div style={{ fontWeight: 600, fontSize: "13px", color: "#475569", marginBottom: "2px" }}>No notifications</div>
                <div style={{ fontSize: "11px" }}>All caught up!</div>
              </div>
            )}
            {!isLoading &&
              visibleNotifications.map(notif => {
                const meta = TYPE_META[notif.type] ?? { icon: <Info size={12} />, color: "#64748b" };
                return (
                  <div
                    key={notif.id}
                    className={`notif-item ${notif.is_read ? "" : "is-unread"}`}
                    onClick={(e) => handleNotificationClick(e, notif)}
                    style={{
                      display: "flex",
                      gap: "10px",
                      padding: "8px 12px",
                      background: notif.is_read ? "#fff" : "#f8fafc",
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      transition: "background 0.15s",
                      position: "relative",
                      minHeight: "60px",
                    }}
                  >
                    {/* Icon Column */}
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        background: `${meta.color}10`,
                        color: meta.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: "2px",
                      }}
                    >
                      {meta.icon}
                    </div>

                    {/* Content Column */}
                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: "13px",
                          color: "#1e293b",
                          lineHeight: "1.2",
                          marginBottom: "1px",
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
                          color: "#64748b",
                          lineHeight: "1.3",
                          marginBottom: "2px",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {notif.message}
                      </div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                        {relativeTime(notif.created_at)}
                      </div>
                    </div>

                    {/* Status Column */}
                    {!notif.is_read && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "6px",
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "#3b82f6",
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div
              className="notif-footer"
              style={{
                height: "36px",
                padding: "0 12px",
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#fff",
                position: "sticky",
                bottom: 0,
                zIndex: 2,
              }}
            >
              {hasMore && !isExpanded ? (
                <button
                  onClick={() => setIsExpanded(true)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "#3b82f6",
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    transition: "background 0.2s",
                    width: "100%",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#eff6ff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  View all ({notifications.length})
                </button>
              ) : (
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  {isExpanded ? "All notifications" : `${notifications.length} notifications`}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .notif-item:hover {
          background-color: #f8fafc !important;
        }
        .notif-action-btn:hover {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
        }
        .notif-spinner {
          width: 12px;
          height: 12px;
          border: 1.5px solid #e2e8f0;
          border-top-color: #3b82f6;
          border-radius: 50%;
          display: inline-block;
          margin-right: 6px;
          animation: notif-spin 0.6s linear infinite;
          vertical-align: middle;
        }
        @keyframes notif-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes notif-drop {
          from { opacity: 0; transform: translateY(-8px) scale(0.99); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .notif-list::-webkit-scrollbar {
          width: 4px;
        }
        .notif-list::-webkit-scrollbar-track {
          background: transparent;
        }
        .notif-list::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .notif-list::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
