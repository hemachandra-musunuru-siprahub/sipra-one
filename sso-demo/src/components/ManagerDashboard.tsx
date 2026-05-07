import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { Users, CheckSquare, Clock, CheckCircle } from "lucide-react";

import { TopAnnouncementsCarousel } from "./TopAnnouncementsCarousel";
import { getTeamLeave, actionLeave } from "../api/leave";
import { getTeamTimesheets, reviewTimesheet } from "../api/timesheets";
import type { LeaveRequest, Timesheet } from "../api/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { internalUser: any; }

export const ManagerDashboard = ({ internalUser }: Props) => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    Promise.all([getTeamLeave(), getTeamTimesheets()])
      .then(([leaveData, tsData]) => {
        setLeaveRequests(leaveData.requests);
        setTimesheets(tsData.timesheets);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pendingLeave = leaveRequests.filter(r => r.status === "pending");
  const submittedTs = timesheets.filter(t => t.status === "submitted");
  const reviewedTs = timesheets.filter(t => t.status === "reviewed");

  const stats = [
    { label: "Pending Approvals", value: loading ? "…" : `${pendingLeave.length}`, trend: "Requires Action", icon: <CheckSquare size={20} />, color: "#CE2124" },
    { label: "Timesheets Pending", value: loading ? "…" : `${submittedTs.length}`, trend: "Awaiting Review", icon: <Clock size={20} />, color: "#3B82F6" },
    { label: "Reviewed", value: loading ? "…" : `${reviewedTs.length}`, trend: "Completed", icon: <CheckCircle size={20} />, color: "#10B981" },
    { label: "Team Size", value: "—", trend: "From Entra ID", icon: <Users size={20} />, color: "#8B5CF6" },
  ];

  const handleApprove = async (id: string) => {
    try {
      const { request } = await actionLeave(id, "approved");
      setLeaveRequests(prev => prev.map(r => r.id === id ? request : r));
    } catch (e) { console.error(e); }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return;
    try {
      const { request } = await actionLeave(id, "rejected", rejectReason);
      setLeaveRequests(prev => prev.map(r => r.id === id ? request : r));
      setRejectingId(null); setRejectReason("");
    } catch (e) { console.error(e); }
  };

  const handleReviewTs = async (id: string, status: "reviewed" | "draft") => {
    try {
      const { timesheet } = await reviewTimesheet(id, status);
      setTimesheets(prev => prev.map(t => t.id === id ? timesheet : t));
    } catch (e) { console.error(e); }
  };

  return (
    <DashboardLayout internalUser={internalUser} role="Manager">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Home</span><span className="breadcrumb__separator">/</span><span>Manager Dashboard</span>
        </div>
        <h1 className="page-title">Team Overview</h1>
      </header>

      <section className="welcome-card" style={{ height: "140px", padding: "var(--space-6) var(--space-10)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "var(--space-6)" }}>
        <div className="welcome-card__content" style={{ textAlign: "center", width: "100%" }}>
          <h1 className="welcome-card__title" style={{ fontSize: "2.5rem", fontWeight: 700, margin: 0, color: "white" }}>
            Welcome back, {internalUser?.name?.split(" ")[0] || "there"}!
          </h1>
        </div>
      </section>

      <TopAnnouncementsCarousel />

      <section className="stats-grid">
        {stats.map((s, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-card__header">
              <div className="stat-card__icon" style={{ backgroundColor: `${s.color}15`, color: s.color }}>{s.icon}</div>
              <span className="stat-card__trend" style={{ color: s.color }}>{s.trend}</span>
            </div>
            <div><div className="stat-card__label">{s.label}</div><div className="stat-card__value">{s.value}</div></div>
          </div>
        ))}
      </section>

      {rejectingId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="card" style={{ width: 420, padding: "var(--space-6)" }}>
            <h3 style={{ marginBottom: "var(--space-4)" }}>Rejection Reason</h3>
            <textarea className="input" rows={3} placeholder="Reason *" value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ width: "100%", marginBottom: "var(--space-4)", resize: "vertical" }} />
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <button className="btn btn--primary" onClick={() => handleReject(rejectingId)}>Confirm</button>
              <button className="btn btn--secondary" onClick={() => { setRejectingId(null); setRejectReason(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="content-grid">
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__header">
            <h3 className="card__title">Pending Team Leave Requests</h3>
            <span className="badge badge--urgent">{pendingLeave.length}</span>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Days</th><th>Dates</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading…</td></tr>
                  : pendingLeave.length === 0 ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No pending requests 🎉</td></tr>
                    : pendingLeave.map(req => (
                      <tr key={req.id}>
                        <td style={{ fontSize: "0.875rem" }}>{req.employee_name || req.employee_oid.slice(0, 8) + "…"}</td>
                        <td><span className="badge badge--hr">{req.leave_type}</span></td>
                        <td>{req.total_days}</td>
                        <td style={{ fontSize: "0.875rem" }}>{req.start_date} → {req.end_date}</td>
                        <td><span className="badge badge--draft">{req.status}</span></td>
                        <td>
                          <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            <button className="btn btn--primary btn--sm" style={{ height: 28, fontSize: "0.75rem" }} onClick={() => handleApprove(req.id)}>Approve</button>
                            <button className="btn btn--secondary btn--sm" style={{ height: 28, fontSize: "0.75rem" }} onClick={() => setRejectingId(req.id)}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__header">
            <h3 className="card__title">Team Timesheets — Awaiting Review</h3>
            <span className="badge badge--draft">{submittedTs.length} submitted</span>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Employee</th><th>Week Starting</th><th>Total Hours</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading…</td></tr>
                  : submittedTs.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No timesheets awaiting review</td></tr>
                    : submittedTs.map(ts => (
                      <tr key={ts.id}>
                        <td style={{ fontSize: "0.875rem" }}>{ts.employee_name || ts.employee_oid.slice(0, 8) + "…"}</td>
                        <td>{ts.week_start_date}</td>
                        <td><strong>{ts.total_hours}h</strong></td>
                        <td><span className="badge badge--draft">{ts.status}</span></td>
                        <td>
                          <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            <button className="btn btn--primary btn--sm" style={{ height: 28, fontSize: "0.75rem" }} onClick={() => handleReviewTs(ts.id, "reviewed")}>Approve</button>
                            <button className="btn btn--secondary btn--sm" style={{ height: 28, fontSize: "0.75rem" }} onClick={() => handleReviewTs(ts.id, "draft")}>Send Back</button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
