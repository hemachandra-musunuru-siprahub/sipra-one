import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { Calendar, Clock, Megaphone, FileText, User, HelpCircle, ArrowRight } from "lucide-react";
import { getAnnouncements } from "../api/announcements";
import { getMyTimesheet } from "../api/timesheets";
import { getDashboardSummary } from "../api/users";
import { TopAnnouncementsCarousel } from "./TopAnnouncementsCarousel";
import type { LeaveBalance, Timesheet } from "../api/types";
import { formatDate } from "../utils/dateFormatter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { internalUser: any; }

export const EmployeeDashboard = ({ internalUser }: Props) => {
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [counts, setCounts] = useState({ documents: 0, announcements: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAnnouncements(1, 5),
      getMyTimesheet(),
      getDashboardSummary(),
    ])
      .then(([, tsData, dashData]) => {
        setTimesheet(tsData.timesheet);
        setBalances(dashData.leaveBalances);
        setCounts(dashData.counts);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const annualBalance = balances.find(b => b.leave_type === "annual");
  const annualDays = annualBalance ? `${annualBalance.remaining_days}` : "—";
  const annualSub = annualBalance ? `of ${annualBalance.total_days} days remaining` : "No balance data";
  const tsStatus = timesheet
    ? timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)
    : "—";

  const stats = [
    {
      label: "Annual Leave",
      value: loading ? "—" : annualDays,
      sub: annualSub,
      icon: <Calendar size={16} />,
      color: "#CE2124",
      bg: "#FFF0F0",
    },
    {
      label: "Timesheet",
      value: loading ? "—" : tsStatus,
      sub: "Current week",
      icon: <Clock size={16} />,
      color: "#3B82F6",
      bg: "#EFF6FF",
    },
    {
      label: "Announcements",
      value: loading ? "—" : `${counts.announcements}`,
      sub: "Published",
      icon: <Megaphone size={16} />,
      color: "#F59E0B",
      bg: "#FFFBEB",
    },
    {
      label: "Documents",
      value: loading ? "—" : `${counts.documents}`,
      sub: "Shared with me",
      icon: <FileText size={16} />,
      color: "#10B981",
      bg: "#ECFDF5",
    },
  ];

  const allModules = [
    { title: "My Profile", icon: <User size={18} />, path: "/employee/profile", color: "#8B5CF6" },
    { title: "My Leave", icon: <Calendar size={18} />, path: "/employee/leave", color: "#CE2124" },
    { title: "My Timesheets", icon: <Clock size={18} />, path: "/employee/timesheets", color: "#3B82F6" },
    { title: "Company News", icon: <Megaphone size={18} />, path: "/employee/announcements", color: "#F59E0B" },
    { title: "Documents", icon: <FileText size={18} />, path: "/employee/documents", color: "#10B981" },
    { title: "Help & Support", icon: <HelpCircle size={18} />, path: "#", color: "#6B7280" },
  ];

  const modules = internalUser?.role === "Employee"
    ? allModules.filter(m => m.title !== "My Profile" && m.title !== "Help & Support")
    : allModules;

  const getStatusBadgeStyle = (status: string) => {
    if (status === "reviewed") return { background: "#ECFDF5", color: "#047857" };
    if (status === "submitted") return { background: "#EFF6FF", color: "#1D4ED8" };
    return { background: "var(--neutral-100)", color: "var(--neutral-500)" };
  };

  return (
    <DashboardLayout internalUser={internalUser} role="Employee">

      {/* ── Page Header ── */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          fontSize: "12px", color: "var(--neutral-400)",
          marginBottom: "6px", fontWeight: 500,
        }}>
          <span>Home</span>
          <span style={{ color: "var(--neutral-300)" }}>/</span>
          <span style={{ color: "var(--neutral-600)" }}>Dashboard</span>
        </div>
        <h1 style={{
          fontSize: "1.375rem", fontWeight: 700,
          color: "var(--neutral-900)", letterSpacing: "-0.02em",
        }}>
          My Dashboard
        </h1>
      </div>

      {/* ── Compact Hero Banner ── */}
      <div style={{
        background: "linear-gradient(120deg, #047857 0%, #10B981 100%)",
        borderRadius: "12px",
        padding: "16px 24px",
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        minHeight: "72px",
      }}>
        <div style={{
          position: "absolute", top: "-30px", right: "-30px",
          width: "120px", height: "120px",
          borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-20px", right: "80px",
          width: "70px", height: "70px",
          borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)", fontWeight: 500, marginBottom: "2px" }}>
            Employee Portal
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "white", margin: 0 }}>
            Welcome back, {internalUser?.name?.split(" ")[0] || "there"} 👋
          </h2>
        </div>
        <div style={{ position: "relative", zIndex: 1, textAlign: "right" }}>
          <div style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.55)", marginBottom: "2px", fontWeight: 500 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
            {annualBalance ? `${annualBalance.remaining_days} leave days remaining` : "Check your leave balance"}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "12px",
        marginBottom: "20px",
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: "var(--neutral-0)",
            border: "1px solid var(--neutral-200)",
            borderRadius: "10px",
            padding: "14px 16px",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", letterSpacing: "0.01em" }}>
                {s.label}
              </span>
              <div style={{
                width: "26px", height: "26px", borderRadius: "6px",
                background: s.bg, color: s.color,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {s.icon}
              </div>
            </div>
            <div style={{
              fontSize: "1.75rem", fontWeight: 700,
              color: "var(--neutral-900)", lineHeight: 1, letterSpacing: "-0.03em",
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--neutral-400)", fontWeight: 500 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Featured Announcements ── */}
      <div style={{ marginBottom: "20px" }}>
        <TopAnnouncementsCarousel />
      </div>

      {/* ── Quick Access Grid ── */}
      <div style={{
        background: "var(--neutral-0)",
        border: "1px solid var(--neutral-200)",
        borderRadius: "10px",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
        marginBottom: "16px",
      }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--neutral-100)" }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)", margin: 0 }}>
            Quick Access
          </h3>
        </div>
        <div style={{
          padding: "14px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "12px",
        }}>
          {modules.map((mod, i) => (
            <a
              key={i}
              href={mod.path}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "12px 14px",
                borderRadius: "8px",
                border: "1px solid var(--neutral-100)",
                background: "var(--neutral-50)",
                textDecoration: "none",
                transition: "all 150ms",
                cursor: "pointer",
              }}
              onMouseOver={e => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.borderColor = "var(--neutral-200)";
                e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              }}
              onMouseOut={e => {
                e.currentTarget.style.background = "var(--neutral-50)";
                e.currentTarget.style.borderColor = "var(--neutral-100)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{
                width: "32px", height: "32px",
                borderRadius: "8px",
                background: `${mod.color}15`,
                color: mod.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {mod.icon}
              </div>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--neutral-700)" }}>
                {mod.title}
              </span>
            </a>
          ))}
        </div>
      </div>

      {/* ── Current Week Timesheet ── */}
      {timesheet && (
        <div style={{
          background: "var(--neutral-0)",
          border: "1px solid var(--neutral-200)",
          borderRadius: "10px",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--neutral-100)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)", margin: 0 }}>
              Current Week Timesheet
            </h3>
            <a
              href="/employee/timesheets"
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                fontSize: "0.75rem", fontWeight: 600, color: "var(--primary-500)",
                textDecoration: "none",
              }}
            >
              Open <ArrowRight size={11} />
            </a>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  {["Week Of", "Total Hours", "Entries", "Status", "Action"].map(h => (
                    <th key={h} style={{
                      background: "var(--neutral-50)",
                      padding: "8px 12px",
                      fontSize: "0.6875rem", fontWeight: 600,
                      color: "var(--neutral-400)",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      borderBottom: "1px solid var(--neutral-200)",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "10px 12px", fontSize: "0.8125rem", fontWeight: 500, color: "var(--neutral-700)" }}>
                    {formatDate(timesheet.week_start_date)}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ fontSize: "1rem", fontWeight: 700, color: "var(--primary-600)" }}>
                      {timesheet.total_hours}h
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", fontSize: "0.8125rem", color: "var(--neutral-500)" }}>
                    {timesheet.entries?.length || 0} entries
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      ...getStatusBadgeStyle(timesheet.status),
                      padding: "2px 8px", borderRadius: "20px",
                      fontSize: "0.6875rem", fontWeight: 600,
                    }}>
                      {timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <a
                      href="/employee/timesheets"
                      style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--primary-500)", textDecoration: "none" }}
                    >
                      View Details
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
