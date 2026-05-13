import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import {
  Calendar,
  Plus,
  XCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Inbox,
  ChevronRight,
  FileText,
} from "lucide-react";
import { getMyLeave, getLeaveBalances, submitLeave, cancelLeave } from "../../api/leave";
import type { LeaveRequest, LeaveBalance } from "../../api/types";
import { formatLeaveDates } from "../../utils/dateFormatter";

interface Props { internalUser: any; role?: string; }

/* ─── Toast ─────────────────────────────────────────────── */
type ToastType = "success" | "error" | "warning";
interface Toast { id: number; type: ToastType; title: string; message?: string; }

let _toastId = 0;

/* ─── Helpers ───────────────────────────────────────────── */
const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual", sick: "Sick", casual: "Casual", unpaid: "Unpaid", other: "Other",
};

const statusClass = (s: string) => ({
  pending: "status-badge--pending",
  approved: "status-badge--approved",
  rejected: "status-badge--rejected",
  cancelled: "status-badge--cancelled",
}[s] ?? "status-badge--pending");

const leaveTypeAccent = (t: string) =>
  ({ annual: "annual", sick: "sick", casual: "casual", unpaid: "unpaid", other: "other" }[t] ?? "other");

/* ─── Sub-components ────────────────────────────────────── */
function BalanceSkeleton() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "var(--space-4)" }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="leave-balance-card">
          <div className="skeleton skeleton--text" style={{ width: "60%" }} />
          <div className="skeleton skeleton--title" style={{ width: "40%", height: 28 }} />
          <div className="skeleton skeleton--text" style={{ width: "80%" }} />
          <div className="progress-track"><div className="skeleton" style={{ width: "100%", height: 4 }} /></div>
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map(i => (
        <tr key={i}>
          <td colSpan={6} style={{ padding: 0, borderBottom: "1px solid var(--neutral-200)" }}>
            <div className="skeleton skeleton--row" style={{ margin: "4px 0" }} />
          </td>
        </tr>
      ))}
    </>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
import { normalizeRole } from "../../lib/roleHelper";
import type { UserRole } from "../../lib/roleHelper";

export const EmployeeLeavePage = ({ internalUser, role }: Props) => {
  const displayRole: UserRole = normalizeRole(role || internalUser?.roleFromEntra || "Employee");
  const isHRRole = displayRole === "HR";
  const isManagerRole = displayRole === "Manager";
  const isAdminRole = displayRole === "Admin";

  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    leaveType: "annual" as "annual" | "sick" | "unpaid" | "other",
    startDate: "", endDate: "", reason: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [detailRequest, setDetailRequest] = useState<LeaveRequest | null>(null);
  const [detailMode, setDetailMode] = useState<"reason" | "rejection" | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  /* ─── Toast helpers ── */
  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++_toastId;
    setToasts(t => [...t, { id, type, title, message }]);
    if (type !== "error") setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);
  const removeToast = (id: number) => setToasts(t => t.filter(x => x.id !== id));

  /* ─── Load data ── */
  const fetchData = useCallback(() => {
    Promise.all([getMyLeave(), getLeaveBalances()])
      .then(([lData, bData]) => {
        setRequests(lData.requests || []);
        setBalances(bData.balances || []);
      })
      .catch((err) => {
        console.error("Failed to load leave data:", err);
        addToast("error", "Failed to load leave data", "Please refresh the page.");
      })
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── Validation ── */
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.startDate) errs.startDate = "Start date is required";
    if (!form.endDate) errs.endDate = "End date is required";
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      errs.endDate = "End date must be after start date";
    return errs;
  };

  /* ─── Submit ── */
  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const { request } = await submitLeave(form);
      setRequests(prev => [request, ...prev]);
      setForm({ leaveType: "annual", startDate: "", endDate: "", reason: "" });
      setShowForm(false);
      fetchData();
      const isAutoApproved = isHRRole || isManagerRole;
      addToast(
        "success",
        isAutoApproved ? "Leave approved" : "Request submitted",
        isAutoApproved ? "Your leave was auto-approved." : "Your manager has been notified."
      );
    } catch (e: any) {
      addToast("error", "Submission failed", e.message || "An error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ─── Cancel ── */
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      const { request } = await cancelLeave(cancelTarget);
      setRequests(prev => prev.map(r => r.id === cancelTarget ? request : r));
      fetchData();
      addToast("success", "Request cancelled");
    } catch (e: any) {
      addToast("error", "Cancel failed", e.message);
    } finally {
      setCancelTarget(null);
    }
  };

  /* ─── Derived ── */
  const filteredRequests = requests.filter(r =>
    activeTab === "all" ? true : r.status === activeTab
  );

  const selectedBalance = balances.find(b => b.leave_type === form.leaveType);
  const isLowBalance = selectedBalance && selectedBalance.remaining_days <= 2;

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  if (isAdminRole) {
    return (
      <DashboardLayout internalUser={internalUser} role="Admin">
        <div className="card" style={{ margin: "var(--space-12) auto", maxWidth: 500, textAlign: "center" }}>
          <div className="card__body">
            <XCircle size={48} color="var(--error-500)" style={{ marginBottom: "var(--space-4)" }} />
            <h2 className="card__title" style={{ fontSize: "1.5rem" }}>Access Denied</h2>
            <p style={{ color: "var(--neutral-500)", marginTop: "var(--space-2)" }}>Admin users do not have leave accounts.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout internalUser={internalUser} role={displayRole}>
      {/* ── Page Header ──────────────────────────────────────── */}
      <header className="page-header" style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "baseline",
        borderBottom: "1px solid var(--neutral-100)",
        paddingBottom: "var(--space-4)"
      }}>
        <div>
          <h1 className="page-title" style={{ fontSize: "1.5rem", margin: 0 }}>My Leave</h1>
        </div>
        <button className="btn btn--primary" onClick={() => setShowForm(true)} style={{ height: "32px", fontSize: "0.8125rem", padding: "0 var(--space-3)" }}>
          <Plus size={16} /> Apply for Leave
        </button>
      </header>

      {/* ── KPI Grid ────────────────────────────────────────── */}
      <section className="kpi-grid" style={{ marginBottom: "var(--space-5)" }}>
        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} className="kpi-card skeleton-card">
              <div className="skeleton" style={{ width: "40%", height: 10, marginBottom: 6 }} />
              <div className="skeleton" style={{ width: "60%", height: 20 }} />
            </div>
          ))
        ) : (
          balances.map(b => {
            const pct = b.total_days > 0 ? (b.used_days / b.total_days) * 100 : 0;
            const accent = leaveTypeAccent(b.leave_type);
            return (
              <div key={b.id} className="kpi-card" style={{ minHeight: "90px" }}>
                <Calendar size={28} className="kpi-card__icon" />
                <div className="kpi-card__label">{LEAVE_TYPE_LABELS[b.leave_type] || b.leave_type}</div>
                <div className="kpi-card__value">
                  {b.remaining_days}
                  <span style={{ fontSize: "0.75rem", marginLeft: "2px" }}> / {b.total_days} days</span>
                </div>
                <div className="kpi-card__progress" style={{ marginTop: "auto" }}>
                  <div className={`kpi-card__bar progress-fill--${accent}`} style={{ width: `${pct}%` }} />
                </div>
                <div style={{ fontSize: "0.625rem", color: "var(--neutral-400)", marginTop: 2 }}>
                  {b.used_days}d used
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* ── History Section ──────────────────────────────────── */}
      <div className="card" style={{ border: "1px solid var(--neutral-100)", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
        <div className="card__header" style={{ padding: "var(--space-3) var(--space-6)", background: "var(--neutral-0)" }}>
          <h3 className="card__title" style={{ fontSize: "0.875rem", color: "var(--neutral-500)" }}>Leave History</h3>
          {displayRole === "Employee" && (
            <div className="tab-nav" style={{ border: "none", padding: 0, gap: "var(--space-1)" }}>
              {tabs.map(t => (
                <button
                  key={t.key}
                  className={`tab-nav__item ${activeTab === t.key ? "tab-nav__item--active" : ""}`}
                  onClick={() => setActiveTab(t.key)}
                  style={{ fontSize: "0.75rem", padding: "6px 12px", borderRadius: "var(--rounded-md)" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="table-container">
          <table className="leave-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: "var(--space-6)", width: "180px" }}>Leave Type</th>
                <th style={{ width: "200px" }}>Dates</th>
                <th style={{ width: "100px" }}>Duration</th>
                <th>Reason</th>
                <th style={{ width: "120px" }}>Status</th>
                <th style={{ paddingRight: "var(--space-6)", textAlign: "right", width: "100px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: "var(--space-12) 0", textAlign: "center" }}>
                    <Inbox size={40} color="var(--neutral-100)" style={{ margin: "0 auto var(--space-3)" }} />
                    <div style={{ fontWeight: 600, color: "var(--neutral-400)", fontSize: "0.875rem" }}>No records found</div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map(r => (
                  <tr key={r.id}>
                    <td style={{ paddingLeft: "var(--space-6)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span className={`leave-type-dot leave-type-dot--${leaveTypeAccent(r.leave_type)}`} style={{ width: 6, height: 6 }} />
                        <span style={{ fontWeight: 500, color: "var(--neutral-700)" }}>
                          {LEAVE_TYPE_LABELS[r.leave_type] || r.leave_type}
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{formatLeaveDates(r.start_date, r.end_date)}</td>
                    <td>
                      <span style={{ fontWeight: 600, color: "var(--neutral-800)" }}>{r.total_days}</span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--neutral-400)", marginLeft: 3 }}>days</span>
                    </td>
                    <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis" }}>
                      <button 
                        className="link-btn" 
                        onClick={() => { setDetailRequest(r); setDetailMode("reason"); }}
                        style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", textDecoration: "none" }}
                      >
                        {r.reason || "—"}
                      </button>
                    </td>
                    <td>
                      <span className={`status-badge status-badge--${r.status}`} style={{ fontSize: "0.6875rem", padding: "1px 8px" }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ paddingRight: "var(--space-6)", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-1)" }}>
                        {r.status === "pending" && (
                          <button className="btn--icon btn--icon-danger" onClick={() => setCancelTarget(r.id)} style={{ width: 24, height: 24 }}>
                            <X size={12} />
                          </button>
                        )}
                        <button className="btn--icon" onClick={() => { setDetailRequest(r); setDetailMode("reason"); }} style={{ width: 24, height: 24 }}>
                          <ChevronRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Apply for Leave Drawer ────────────────────────────── */}
      {showForm && (
        <div className="drawer-overlay" onClick={() => setShowForm(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer__header">
              <h2 className="drawer__title">Apply for Leave</h2>
              <button className="topbar__icon-btn" onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            
            <div className="drawer__body">
              <div className="form-field--compact">
                <label className="form-label--compact">Leave Type</label>
                <select 
                  className="form-select--compact"
                  value={form.leaveType}
                  onChange={e => setForm(f => ({ ...f, leaveType: e.target.value as any }))}
                >
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {isLowBalance && (
                <div className="alert alert--warning" style={{ marginBottom: "var(--space-4)", padding: "10px" }}>
                  <AlertTriangle size={14} />
                  <span style={{ fontSize: "0.75rem" }}>Low balance: {selectedBalance?.remaining_days} days left.</span>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <div className="form-field--compact">
                  <label className="form-label--compact">Start Date</label>
                  <input 
                    type="date" 
                    className={`form-input--compact ${fieldErrors.startDate ? "border-error" : ""}`}
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  />
                  {fieldErrors.startDate && <div className="form-error">{fieldErrors.startDate}</div>}
                </div>
                <div className="form-field--compact">
                  <label className="form-label--compact">End Date</label>
                  <input 
                    type="date" 
                    className={`form-input--compact ${fieldErrors.endDate ? "border-error" : ""}`}
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  />
                  {fieldErrors.endDate && <div className="form-error">{fieldErrors.endDate}</div>}
                </div>
              </div>

              <div className="form-field--compact">
                <label className="form-label--compact">Reason (Optional)</label>
                <textarea 
                  className="form-textarea--compact"
                  placeholder="Tell us why you're taking leave..."
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                />
              </div>
            </div>

            <div className="drawer__footer">
              <button className="btn btn--primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
              <button className="btn btn--secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Details / Cancel Modals ── */}
      {/* (Preserving existing logic for these) */}
      {detailRequest && detailMode && (
        <div className="modal-overlay" onClick={() => { setDetailRequest(null); setDetailMode(null); }}>
          <div className="modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">{detailMode === "reason" ? "Request Details" : "Rejection Details"}</div>
              <button className="topbar__icon-btn" onClick={() => { setDetailRequest(null); setDetailMode(null); }}><X size={18} /></button>
            </div>
            <div className="modal__body">
              <div style={{ padding: "var(--space-4)", background: "var(--neutral-50)", borderRadius: "var(--rounded-md)", fontSize: "0.9rem" }}>
                {detailMode === "reason" ? (detailRequest.reason || "No reason provided.") : (detailRequest.manager_comment || "No comment provided.")}
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div className="modal-overlay" onClick={() => setCancelTarget(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Cancel Request?</div>
              <div className="modal__subtitle">This action cannot be undone.</div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--primary" style={{ background: "var(--error-500)" }} onClick={handleConfirmCancel}>Confirm Cancel</button>
              <button className="btn btn--secondary" onClick={() => setCancelTarget(null)}>Keep Request</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <div className="toast__content">
              <div className="toast__title">{t.title}</div>
              {t.message && <div className="toast__message">{t.message}</div>}
            </div>
            <button className="toast__close" onClick={() => removeToast(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>

    </DashboardLayout>
  );
};

