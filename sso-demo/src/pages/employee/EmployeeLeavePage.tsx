import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Calendar, Plus, XCircle } from "lucide-react";
import { getMyLeave, getLeaveBalances, submitLeave, cancelLeave } from "../../api/leave";
import type { LeaveRequest, LeaveBalance } from "../../api/types";

interface Props { internalUser: any; }

export const EmployeeLeavePage = ({ internalUser }: Props) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ leaveType: "annual" as const, startDate: "", endDate: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMyLeave(), getLeaveBalances()])
      .then(([lData, bData]) => { setRequests(lData.requests); setBalances(bData.balances); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!form.startDate || !form.endDate) { setError("Please fill all required fields."); return; }
    setSubmitting(true);
    try {
      const { request } = await submitLeave(form);
      setRequests(prev => [request, ...prev]);
      setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      setShowForm(false);
    } catch (e: any) { setError(e.message || "Failed to submit leave request"); }
    finally { setSubmitting(false); }
  };

  const handleCancel = async (id: string) => {
    try {
      const { request } = await cancelLeave(id);
      setRequests(prev => prev.map(r => r.id === id ? request : r));
    } catch (e: any) { alert(e.message); }
  };

  const statusColor = (s: string) => ({ pending: "badge--draft", approved: "badge--published", rejected: "badge--urgent", cancelled: "badge--it" }[s] || "badge--draft");

  return (
    <DashboardLayout internalUser={internalUser} role="Employee">
      <header className="page-header">
        <div className="breadcrumb"><span>Employee</span><span className="breadcrumb__separator">/</span><span>Leave</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">My Leave</h1>
          <button className="btn btn--primary" onClick={() => setShowForm(v => !v)}><Plus size={16} /> Request Leave</button>
        </div>
      </header>

      {/* Balance Cards */}
      <section className="stats-grid" style={{ marginBottom: "var(--space-6)" }}>
        {loading ? <div className="stat-card"><div className="stat-card__label">Loading…</div></div> :
          balances.length === 0 ? <div className="stat-card"><div className="stat-card__label">No balances set yet. Contact HR.</div></div> :
          balances.map(b => (
            <div className="stat-card" key={b.id}>
              <div className="stat-card__header">
                <div className="stat-card__icon" style={{ backgroundColor: "#3B82F615", color: "#3B82F6" }}><Calendar size={20} /></div>
                <span className="stat-card__trend" style={{ color: "#10B981" }}>{b.used_days} used</span>
              </div>
              <div>
                <div className="stat-card__label">{b.leave_type.charAt(0).toUpperCase() + b.leave_type.slice(1)} Leave ({b.year})</div>
                <div className="stat-card__value">{b.remaining_days} / {b.total_days} days</div>
              </div>
            </div>
          ))
        }
      </section>

      {/* Request Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="card__header"><h3 className="card__title">New Leave Request</h3></div>
          <div className="card__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Leave Type *</label>
              <select className="input" value={form.leaveType} onChange={e => setForm(f => ({ ...f, leaveType: e.target.value as any }))}>
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="unpaid">Unpaid</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Start Date *</label>
              <input className="input" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>End Date *</label>
              <input className="input" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Reason (optional)</label>
              <textarea className="input" rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} style={{ resize: "vertical" }} />
            </div>
          </div>
          {error && <div style={{ padding: "0 var(--space-6)", color: "var(--error-600)", fontSize: "0.875rem" }}>{error}</div>}
          <div className="card__footer" style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting}>{submitting ? "Submitting…" : "Submit Request"}</button>
            <button className="btn btn--secondary" onClick={() => { setShowForm(false); setError(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Requests Table */}
      <div className="card">
        <div className="card__header"><h3 className="card__title">My Leave Requests</h3></div>
        <div className="table-container">
          <table>
            <thead><tr><th>Type</th><th>Dates</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading…</td></tr>
                : requests.length === 0 ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No leave requests yet</td></tr>
                : requests.map(r => (
                  <tr key={r.id}>
                    <td><span className="badge badge--hr">{r.leave_type}</span></td>
                    <td style={{ fontSize: "0.875rem" }}>{r.start_date} → {r.end_date}</td>
                    <td>{r.total_days}</td>
                    <td style={{ fontSize: "0.875rem", color: "var(--neutral-500)" }}>{r.reason || "—"}</td>
                    <td><span className={`badge ${statusColor(r.status)}`}>{r.status}</span></td>
                    <td>
                      {r.status === "pending" && (
                        <button className="btn btn--ghost btn--sm" style={{ color: "var(--error-500)", height: 28, fontSize: "0.75rem" }} onClick={() => handleCancel(r.id)}>
                          <XCircle size={14} /> Cancel
                        </button>
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
