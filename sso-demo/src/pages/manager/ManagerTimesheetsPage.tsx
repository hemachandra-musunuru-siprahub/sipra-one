import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Calendar, CheckCircle, Download, FileText } from "lucide-react";
import { getTeamTimesheets, reviewTimesheet, exportTimesheets } from "../../api/timesheets";
import type { Timesheet } from "../../api/types";

interface Props { internalUser: any; }

export const ManagerTimesheetsPage = ({ internalUser }: Props) => {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getTeamTimesheets()
      .then(data => setTimesheets(data.timesheets))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleReviewTs = async (id: string, status: "reviewed" | "draft") => {
    try {
      const { timesheet } = await reviewTimesheet(id, status);
      setTimesheets(prev => prev.map(t => t.id === id ? timesheet : t));
    } catch (e) { console.error(e); }
  };

  const filteredTimesheets = timesheets.filter(t => filter === "all" ? true : t.status === filter);
  const submittedCount = timesheets.filter(t => t.status === "submitted").length;

  return (
    <DashboardLayout internalUser={internalUser} role="Manager">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Manager</span><span className="breadcrumb__separator">/</span><span>Team Timesheets</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Team Timesheets</h1>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--neutral-600)", marginRight: "var(--space-4)" }}>
              {submittedCount} awaiting review
            </span>
            <button className="btn btn--secondary" onClick={() => { const d = new Date().toISOString().slice(0,10); exportTimesheets("2026-01-01", d); }}>
              <Download size={16} /> Export
            </button>
          </div>
        </div>
      </header>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title"><Calendar size={18} style={{ marginRight: "var(--space-2)" }} /> All Team Timesheets</h3>
          <select className="input" style={{ width: 150 }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Employee</th><th>Week Starting</th><th>Total Hours</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading…</td></tr>
                : filteredTimesheets.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No timesheets found</td></tr>
                : filteredTimesheets.map(ts => (
                  <tr key={ts.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <div className="avatar avatar--sm" style={{ width: 24, height: 24 }}>{(ts.employee_name || "E")[0]}</div>
                        <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{ts.employee_name || ts.employee_oid.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: "0.875rem" }}>{ts.week_start_date}</td>
                    <td><strong>{ts.total_hours}h</strong></td>
                    <td>
                      <span className={`badge ${ts.status === "reviewed" ? "badge--published" : "badge--draft"}`}>
                        {ts.status}
                      </span>
                    </td>
                    <td>
                      {ts.status === "submitted" ? (
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <button className="btn btn--primary btn--sm" style={{ height: 28, fontSize: "0.75rem" }} onClick={() => handleReviewTs(ts.id, "reviewed")}>Approve</button>
                          <button className="btn btn--secondary btn--sm" style={{ height: 28, fontSize: "0.75rem" }} onClick={() => handleReviewTs(ts.id, "draft")}>Send Back</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--neutral-400)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle size={14} style={{ color: "var(--success-500)" }} /> Reviewed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};
