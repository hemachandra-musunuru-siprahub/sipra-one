import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { Calendar, Clock, Megaphone, FileText, User, HelpCircle } from "lucide-react";
import { getAnnouncements } from "../api/announcements";
import { getLeaveBalances } from "../api/leave";
import { getMyTimesheet } from "../api/timesheets";

import { TopAnnouncementsCarousel } from "./TopAnnouncementsCarousel";
import type { Announcement, LeaveBalance, Timesheet } from "../api/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { internalUser: any; }

export const EmployeeDashboard = ({ internalUser }: Props) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getAnnouncements(1, 5), getLeaveBalances(), getMyTimesheet()])
      .then(([annData, balData, tsData]) => {
        setAnnouncements(annData.announcements);
        setBalances(balData.balances);
        setTimesheet(tsData.timesheet);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const annualBalance = balances.find(b => b.leave_type === "annual");
  const annualDays = annualBalance ? `${annualBalance.remaining_days} Days` : "—";
  const tsStatus = timesheet ? (timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)) : "No Timesheet";

  const stats = [
    { label: "Annual Leave",      value: loading ? "…" : annualDays, trend: "Remaining",     icon: <Calendar size={20} />, color: "#CE2124" },
    { label: "Timesheet Status",  value: loading ? "…" : tsStatus,   trend: "Current Week",  icon: <Clock size={20} />,    color: "#3B82F6" },
    { label: "Announcements",     value: loading ? "…" : `${announcements.length}`, trend: "Unread", icon: <Megaphone size={20} />, color: "#F59E0B" },
    { label: "Documents",         value: "—",                          trend: "Company Docs",  icon: <FileText size={20} />, color: "#10B981" },
  ];

  const modules = [
    { title: "My Profile",    icon: <User />,      path: "/employee/profile" },
    { title: "My Leave",      icon: <Calendar />,  path: "/employee/leave" },
    { title: "My Timesheets", icon: <Clock />,      path: "/employee/timesheets" },
    { title: "Company News",  icon: <Megaphone />, path: "/employee/announcements" },
    { title: "Documents",     icon: <FileText />,  path: "/employee/documents" },
    { title: "Help & Support",icon: <HelpCircle />,path: "#" },
  ];

  return (
    <DashboardLayout internalUser={internalUser} role="Employee">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Home</span><span className="breadcrumb__separator">/</span><span>Employee Dashboard</span>
        </div>
        <h1 className="page-title">Personal Dashboard</h1>
      </header>

      <section className="welcome-card">
        <div className="welcome-card__content">
          <h2 className="welcome-card__title">Welcome back, {internalUser?.name?.split(" ")[0] || "there"}!</h2>
          <p className="welcome-card__text">Stay updated with your latest leave status, timesheets, and company announcements.</p>
        </div>
        <div className="welcome-card__actions">
          <a href="/employee/leave" className="btn btn--secondary" style={{ color: "var(--primary-700)" }}>Request Leave</a>
        </div>
      </section>

      <TopAnnouncementsCarousel />

      <section className="stats-grid">
        {stats.map((stat, idx) => (
          <div className="stat-card" key={idx}>
            <div className="stat-card__header">
              <div className="stat-card__icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>{stat.icon}</div>
              <span className="stat-card__trend" style={{ color: stat.color }}>{stat.trend}</span>
            </div>
            <div><div className="stat-card__label">{stat.label}</div><div className="stat-card__value">{stat.value}</div></div>
          </div>
        ))}
      </section>



      <div className="content-grid">
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__header">
            <h3 className="card__title">Quick Access</h3>
          </div>
          <div className="card__body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "var(--space-4)" }}>
              {modules.map((mod, idx) => (
                <a key={idx} href={mod.path} className="btn btn--secondary" style={{ height: "auto", padding: "var(--space-4)", flexDirection: "column", gap: "var(--space-2)", textDecoration: "none" }}>
                  <span style={{ color: "var(--primary-500)" }}>{mod.icon}</span>
                  <span style={{ fontSize: "0.75rem" }}>{mod.title}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Current week timesheet summary */}
        {timesheet && (
          <div className="card" style={{ gridColumn: "span 12" }}>
            <div className="card__header">
              <h3 className="card__title">Current Week Timesheet</h3>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span className={`badge ${timesheet.status === "reviewed" ? "badge--published" : timesheet.status === "submitted" ? "badge--it" : "badge--draft"}`}>{timesheet.status}</span>
                <a href="/employee/timesheets" className="btn btn--secondary btn--sm">Open Timesheet</a>
              </div>
            </div>
            <div className="card__body">
              <div style={{ display: "flex", gap: "var(--space-8)", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>Week of</div>
                  <div style={{ fontWeight: 600 }}>{timesheet.week_start_date}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>Total Hours</div>
                  <div style={{ fontWeight: 700, fontSize: "1.5rem", color: "var(--primary-600)" }}>{timesheet.total_hours}h</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>Entries</div>
                  <div style={{ fontWeight: 600 }}>{timesheet.entries?.length || 0}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
