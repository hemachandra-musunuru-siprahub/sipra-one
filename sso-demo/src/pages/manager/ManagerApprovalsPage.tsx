import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { UserCheck, CheckSquare, XCircle, Clock } from "lucide-react";
import { getTeamLeave, actionLeave } from "../../api/leave";
import type { LeaveRequest } from "../../api/types";

interface Props { internalUser: any; }

export const ManagerApprovalsPage = ({ internalUser }: Props) => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getTeamLeave()
      .then(data => setLeaveRequests(data.requests))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  const filteredRequests = leaveRequests.filter(r => filter === "all" ? true : r.status === filter);
  const pendingCount = leaveRequests.filter(r => r.status === "pending").length;

  return (
    <DashboardLayout internalUser={internalUser} role="Manager">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Manager</span><span className="breadcrumb__separator">/</span><span>Leave Approvals</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Leave Approvals</h1>
          <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "0.875rem", color: "var(--neutral-600)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              <Clock size={14} style={{ color: "var(--error-500)" }} /> {pendingCount} pending
            </span>
          </div>
        </div>
      </header>

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

      <div className="card">
        <div className="card__header">
          <h3 className="card__title"><UserCheck size={18} style={{ marginRight: "var(--space-2)" }} /> Team Leave Requests</h3>
          <select className="input" style={{ width: 150 }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Employee</th><th>Type</th><th>Days</th><th>Dates</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading…</td></tr>
                : filteredRequests.length === 0 ? <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No requests found</td></tr>
                : filteredRequests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <div className="avatar avatar--sm" style={{ width: 24, height: 24 }}>{(req.employee_name || "E")[0]}</div>
                        <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{req.employee_name || req.employee_oid.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td><span className="badge badge--hr">{req.leave_type}</span></td>
                    <td>{req.total_days}</td>
                    <td style={{ fontSize: "0.875rem" }}>{req.start_date} → {req.end_date}</td>
                    <td style={{ fontSize: "0.75rem", color: "var(--neutral-500)", maxWidth: 150, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {req.reason || "—"}
                    </td>
                    <td>
                      <span className={`badge ${req.status === "approved" ? "badge--published" : req.status === "rejected" ? "badge--urgent" : req.status === "cancelled" ? "badge--it" : "badge--draft"}`}>
                        {req.status}
                      </span>
                    </td>
                    <td>
                      {req.status === "pending" ? (
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <button className="btn btn--primary btn--sm" style={{ height: 28, fontSize: "0.75rem" }} onClick={() => handleApprove(req.id)}>Approve</button>
                          <button className="btn btn--secondary btn--sm" style={{ height: 28, fontSize: "0.75rem" }} onClick={() => setRejectingId(req.id)}>Reject</button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.75rem", color: "var(--neutral-400)" }}>—</span>
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
