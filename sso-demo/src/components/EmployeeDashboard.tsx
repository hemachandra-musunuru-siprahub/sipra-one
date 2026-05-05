import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { Calendar, Clock, Megaphone, FileText, User, HelpCircle } from "lucide-react";
import { getAnnouncements } from "../api/announcements";
import { getMyTimesheet } from "../api/timesheets";
import { getDashboardSummary } from "../api/users";
import { TopAnnouncementsCarousel } from "./TopAnnouncementsCarousel";
import type { Announcement, LeaveBalance, Timesheet } from "../api/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { internalUser: any; }

export const EmployeeDashboard = ({ internalUser }: Props) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [counts, setCounts] = useState({ documents: 0, announcements: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAnnouncements(1, 5),
      getMyTimesheet(),
      getDashboardSummary()
    ])
      .then(([annData, tsData, dashData]) => {
        setAnnouncements(annData.announcements);
        setTimesheet(tsData.timesheet);
        setBalances(dashData.leaveBalances);
        setCounts(dashData.counts);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const annualBalance = balances.find(b => b.leave_type === "annual");
  const annualDays = annualBalance ? `${annualBalance.remaining_days} Days` : "—";
  const tsStatus = timesheet ? (timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)) : "No Timesheet";

  const stats = [
    { label: "Annual Leave", value: loading ? "…" : annualDays, trend: "Remaining", icon: <Calendar size={20} />, color: "#CE2124" },
    { label: "Timesheet Status", value: loading ? "…" : tsStatus, trend: "Current Week", icon: <Clock size={20} />, color: "#3B82F6" },
    { label: "Announcements", value: loading ? "…" : `${counts.announcements}`, trend: "Latest", icon: <Megaphone size={20} />, color: "#F59E0B" },
    { label: "Documents", value: loading ? "…" : `${counts.documents}`, trend: "Shared with me", icon: <FileText size={20} />, color: "#10B981" },
  ];

  const modules = [
    { title: "My Profile", icon: <User />, path: "/employee/profile" },
    { title: "My Leave", icon: <Calendar />, path: "/employee/leave" },
    { title: "My Timesheets", icon: <Clock />, path: "/employee/timesheets" },
    { title: "Company News", icon: <Megaphone />, path: "/employee/announcements" },
    { title: "Documents", icon: <FileText />, path: "/employee/documents" },
    { title: "Help & Support", icon: <HelpCircle />, path: "#" },
  ];

  return (
    <DashboardLayout internalUser={internalUser} role="Employee">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Home</span><span className="breadcrumb__separator">/</span><span>Employee Dashboard</span>
        </div>
        <h1 className="page-title">Personal Dashboard</h1>
      </header>

      <section className="welcome-card" style={{ height: "140px", padding: "var(--space-6) var(--space-10)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "var(--space-6)" }}>
        <div className="welcome-card__content" style={{ textAlign: "center", width: "100%" }}>
          <h1 className="welcome-card__title" style={{ fontSize: "2.5rem", fontWeight: 700, margin: 0, color: "white" }}>
            Welcome back, {internalUser?.name?.split(" ")[0] || "there"}!
          </h1>
        </div>
      </section>

      <div style={{ marginBottom: "var(--space-6)" }}>
        <TopAnnouncementsCarousel />
      </div>

      <section className="stats-grid" style={{ marginBottom: "var(--space-6)" }}>
        {stats.map((stat, idx) => (
          <div className="stat-card" key={idx}>
            <div className="flex items-center gap-4">
              <div className="stat-card__icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color, width: "48px", height: "48px", borderRadius: "50%" }}>{stat.icon}</div>
              <div>
                <div className="stat-card__label" style={{ fontSize: "13px" }}>{stat.label}</div>
                <div className="stat-card__value" style={{ fontSize: "18px", marginTop: "2px" }}>{stat.value}</div>
              </div>
            </div>
            <div className="mt-auto pt-3 border-t border-gray-50">
              <span className="stat-card__trend" style={{ color: stat.color, fontSize: "12px", opacity: 0.8 }}>{stat.trend}</span>
            </div>
          </div>
        ))}
      </section>

      <div className="content-grid" style={{ gap: "var(--space-6)" }}>
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__header">
            <h3 className="card__title">Quick Access</h3>
          </div>
          <div className="card__body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-6)" }}>
              {modules.map((mod, idx) => (
                <a 
                  key={idx} 
                  href={mod.path} 
                  className="btn btn--secondary hover:shadow-md transition-all duration-300" 
                  style={{ 
                    height: "120px", 
                    padding: "var(--space-6)", 
                    flexDirection: "column", 
                    gap: "var(--space-3)", 
                    textDecoration: "none",
                    borderRadius: "10px",
                    background: "var(--neutral-0)"
                  }}
                >
                  <span style={{ color: "var(--primary-500)" }}>
                    {React.cloneElement(mod.icon as React.ReactElement<any>, { size: 28 })}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: 600 }}>{mod.title}</span>
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
              <a href="/employee/timesheets" className="btn btn--secondary" style={{ border: "1px solid var(--neutral-200)", height: "36px" }}>Open Timesheet</a>
            </div>
            <div className="card__body" style={{ padding: 0 }}>
              <div className="table-container">
                <table style={{ borderCollapse: "separate", borderSpacing: 0 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: "var(--space-6)" }}>Week Of</th>
                      <th>Total Hours</th>
                      <th>Entries</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right", paddingRight: "var(--space-6)" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ paddingLeft: "var(--space-6)", fontWeight: 500 }}>{timesheet.week_start_date}</td>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: "1.125rem", color: "var(--primary-600)" }}>{timesheet.total_hours}h</span>
                      </td>
                      <td>{timesheet.entries?.length || 0}</td>
                      <td>
                        <span className={`badge ${timesheet.status === "reviewed" ? "badge--published" : timesheet.status === "submitted" ? "badge--it" : "badge--draft"}`}>
                          {timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", paddingRight: "var(--space-6)" }}>
                         <a href="/employee/timesheets" className="text-primary-500 font-semibold text-sm hover:underline">View Details</a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};
