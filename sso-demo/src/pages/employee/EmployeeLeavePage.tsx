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

interface Props { internalUser: any; }

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

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

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
export const EmployeeLeavePage = ({ internalUser }: Props) => {
  const roles = internalUser?.roles || [];
  const isAdminRole = roles.includes("Admin") || roles.includes("SipraHub-SystemAdmin");
  const isHRRole = roles.includes("HR") || roles.includes("SipraHub-HR");
  const isManagerRole = roles.includes("Manager") || roles.includes("SipraHub-Manager");

  let displayRole: "Admin" | "HR" | "Manager" | "Employee" = "Employee";
  if (isHRRole) displayRole = "HR";
  else if (isManagerRole) displayRole = "Manager";

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
      .then(([lData, bData]) => { setRequests(lData.requests); setBalances(bData.balances); })
      .catch(() => addToast("error", "Failed to load leave data", "Please refresh the page."))
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
      errs.endDate = "End date must be on or after start date";
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
      fetchData(); // Immediately refresh the leave balances from DB
      const isAutoApproved = isHRRole || isManagerRole;
      addToast(
        "success", 
        isAutoApproved ? "Leave approved" : "Leave request submitted", 
        isAutoApproved ? "Your leave has been automatically approved and balance updated." : "Your manager has been notified."
      );
    } catch (e: any) {
      addToast("error", "Submission failed", e.message || "An unexpected error occurred.");
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
      fetchData(); // Immediately refresh the leave balances from DB
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
        <div style={{ padding: 40, textAlign: "center" }}>
          <h2>Access Denied</h2>
          <p>Admin users cannot apply for leave.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout internalUser={internalUser} role={displayRole}>

      {/* ── Page Header ──────────────────────────────────────── */}
      <header className="page-header">
        <div className="breadcrumb">
          <span>{displayRole}</span>
          <ChevronRight size={14} className="breadcrumb__separator" />
          <span className="breadcrumb__current">My leave</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-4)" }}>
          <div>
            <h1 className="page-title">My leave</h1>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => { setShowForm(v => !v); setFieldErrors({}); }}
            style={{ flexShrink: 0 }}
          >
            <Plus size={16} /> Apply for leave
          </button>
        </div>
      </header>

      {/* ── Balance Cards ─────────────────────────────────────── */}
      <section style={{ marginBottom: "var(--space-6)" }}>
        {loading ? <BalanceSkeleton /> : (
          balances.length === 0 ? (
            <div className="alert alert--warning" style={{ maxWidth: 480 }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>No leave balances set yet. Contact HR to configure your allowances.</span>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "var(--space-4)" }}>
              {balances.map(b => {
                const pct = b.total_days > 0 ? Math.max(0, Math.min(100, (b.used_days / b.total_days) * 100)) : 0;
                const accent = leaveTypeAccent(b.leave_type);
                return (
                  <div key={b.id} className={`leave-balance-card leave-balance-card--${accent}`}>
                    <div className="leave-balance-card__label">
                      {LEAVE_TYPE_LABELS[b.leave_type] ?? b.leave_type} leave ({b.year})
                    </div>
                    <div className="leave-balance-card__value">{b.remaining_days}
                      <span style={{ fontSize: "1rem", fontWeight: 400, color: "var(--neutral-500)" }}> / {b.total_days} days</span>
                    </div>
                    <div className="progress-track">
                      <div className={`progress-fill progress-fill--${accent}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="leave-balance-card__meta">{b.used_days} days used</div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </section>

      {/* ── Apply for Leave Form ──────────────────────────────── */}
      {showForm && (
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="card__header">
            <h3 className="card__title">Apply for leave</h3>
            <button
              className="topbar__icon-btn"
              onClick={() => { setShowForm(false); setFieldErrors({}); }}
              aria-label="Close form"
            >
              <X size={18} />
            </button>
          </div>

          <div className="card__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            {/* Leave Type */}
            <div className="form-field" style={{ gridColumn: "span 2" }}>
              <label className="form-label form-label--required">Leave type</label>
              <select
                className="form-select"
                value={form.leaveType}
                onChange={e => setForm(f => ({ ...f, leaveType: e.target.value as any }))}
              >
                <option value="annual">Annual</option>
                <option value="sick">Sick</option>
                <option value="casual">Casual</option>
                <option value="unpaid">Unpaid</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Low balance warning */}
            {isLowBalance && (
              <div className="alert alert--warning" style={{ gridColumn: "span 2" }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  <strong>Low balance:</strong> you have only {selectedBalance!.remaining_days} {form.leaveType} day{selectedBalance!.remaining_days !== 1 ? "s" : ""} remaining.
                </span>
              </div>
            )}

            {/* Start Date */}
            <div className="form-field">
              <label className="form-label form-label--required">Start date</label>
              <input
                type="date"
                className="form-input"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                style={fieldErrors.startDate ? { borderColor: "var(--error-500)" } : {}}
              />
              {fieldErrors.startDate && (
                <span className="form-error"><AlertTriangle size={12} />{fieldErrors.startDate}</span>
              )}
            </div>

            {/* End Date */}
            <div className="form-field">
              <label className="form-label form-label--required">End date</label>
              <input
                type="date"
                className="form-input"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                style={fieldErrors.endDate ? { borderColor: "var(--error-500)" } : {}}
              />
              {fieldErrors.endDate && (
                <span className="form-error"><AlertTriangle size={12} />{fieldErrors.endDate}</span>
              )}
            </div>

            {/* Reason */}
            <div className="form-field" style={{ gridColumn: "span 2" }}>
              <label className="form-label">Reason <span style={{ color: "var(--neutral-400)", fontWeight: 400 }}>(optional)</span></label>
              <textarea
                className="form-textarea"
                placeholder="Briefly describe your reason…"
                rows={3}
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>

          <div className="card__footer" style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit request"}
            </button>
            <button className="btn btn--secondary" onClick={() => { setShowForm(false); setFieldErrors({}); }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Leave History Table ───────────────────────────────── */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Leave history</h3>
          <span style={{ fontSize: "0.875rem", color: "var(--neutral-500)" }}>
            {requests.length} {requests.length === 1 ? "request" : "requests"} total
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="tab-nav" style={{ padding: "0 var(--space-6)" }}>
          {tabs.map(t => (
            <button
              key={t.key}
              className={`tab-nav__item ${activeTab === t.key ? "tab-nav__item--active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {t.key !== "all" && (
                <span style={{
                  marginLeft: 6,
                  fontSize: "0.7rem",
                  background: activeTab === t.key ? "var(--primary-100)" : "var(--neutral-100)",
                  color: activeTab === t.key ? "var(--primary-700)" : "var(--neutral-500)",
                  borderRadius: "var(--rounded-full)",
                  padding: "1px 6px",
                  fontWeight: 600,
                }}>
                  {requests.filter(r => r.status === t.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table className="leave-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ border: "none", padding: 0 }}>
                    <div className="empty-state">
                      <Inbox size={48} className="empty-state__icon" />
                      <div className="empty-state__heading">No {activeTab !== "all" ? activeTab : ""} requests</div>
                      <div className="empty-state__description">
                        {activeTab === "all"
                          ? "You haven't made any leave requests yet. Click \"Apply for leave\" to get started."
                          : `You have no ${activeTab} leave requests.`}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map(r => (
                  <tr key={r.id}>
                    <td>
                      <span className="leave-type-tag">
                        <span className={`leave-type-dot leave-type-dot--${leaveTypeAccent(r.leave_type)}`} />
                        {LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatDate(r.start_date)}
                      <span style={{ color: "var(--neutral-400)", margin: "0 4px" }}>→</span>
                      {formatDate(r.end_date)}
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--neutral-800)" }}>{r.total_days}</td>
                    <td style={{ maxWidth: 200 }}>
                      {r.reason ? (
                        <button
                          onClick={() => { setDetailRequest(r); setDetailMode("reason"); }}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                            color: "var(--primary-500)", fontSize: "0.875rem", fontFamily: "inherit",
                            textAlign: "left", maxWidth: 200,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            display: "block", textDecoration: "underline", textUnderlineOffset: 2,
                          }}
                          title="View full reason"
                        >
                          {r.reason.length > 28 ? r.reason.slice(0, 28) + "…" : r.reason}
                        </button>
                      ) : (
                        <span style={{ color: "var(--neutral-300)" }}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge ${statusClass(r.status)}`}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                      {r.status === "rejected" && r.manager_comment && (
                        <button
                          onClick={() => { setDetailRequest(r); setDetailMode("rejection"); }}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                            color: "var(--error-700)", fontSize: "0.75rem", fontFamily: "inherit",
                            textAlign: "left", display: "block", marginTop: 3,
                            maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            textDecoration: "underline", textUnderlineOffset: 2,
                          }}
                          title="View full rejection reason"
                        >
                          {r.manager_comment.length > 26 ? r.manager_comment.slice(0, 26) + "…" : r.manager_comment}
                        </button>
                      )}
                    </td>
                    <td>
                      {r.status === "pending" && (
                        <button
                          className="btn--cancel-leave"
                          onClick={() => setCancelTarget(r.id)}
                          title="Cancel this request"
                        >
                          <XCircle size={13} /> Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Leave Detail Modal ────────────────────────────────── */}
      {detailRequest && detailMode && (
        <div className="modal-overlay" onClick={() => { setDetailRequest(null); setDetailMode(null); }}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="modal__title">
                  {detailMode === "reason" ? "Leave request reason" : "Rejection reason"}
                </div>
                <div className="modal__subtitle">
                  {detailMode === "reason"
                    ? "Full reason provided for this leave request"
                    : "Manager's comment on why this request was rejected"}
                </div>
              </div>
              <button
                className="topbar__icon-btn"
                onClick={() => { setDetailRequest(null); setDetailMode(null); }}
                aria-label="Close"
                style={{ marginLeft: "var(--space-4)", flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal__body">
              {/* Detail rows */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "var(--space-3) var(--space-4)", marginBottom: "var(--space-5)" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", fontWeight: 500 }}>Leave type</span>
                <span className="leave-type-tag">
                  <span className={`leave-type-dot leave-type-dot--${leaveTypeAccent(detailRequest.leave_type)}`} />
                  {LEAVE_TYPE_LABELS[detailRequest.leave_type] ?? detailRequest.leave_type}
                </span>

                <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", fontWeight: 500 }}>Dates</span>
                <span style={{ fontSize: "0.875rem", color: "var(--neutral-800)" }}>
                  {formatDate(detailRequest.start_date)}
                  <span style={{ color: "var(--neutral-400)", margin: "0 6px" }}>→</span>
                  {formatDate(detailRequest.end_date)}
                </span>

                <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", fontWeight: 500 }}>Days</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)" }}>{detailRequest.total_days}</span>

                <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", fontWeight: 500 }}>Status</span>
                <span className={`status-badge ${statusClass(detailRequest.status)}`}>
                  {detailRequest.status.charAt(0).toUpperCase() + detailRequest.status.slice(1)}
                </span>
              </div>

              {/* Full text */}
              <div style={{
                background: detailMode === "rejection" ? "var(--error-50)" : "var(--neutral-50)",
                border: `1px solid ${detailMode === "rejection" ? "var(--error-500)" : "var(--neutral-200)"}`,
                borderRadius: "var(--rounded-md)",
                padding: "var(--space-4)",
              }}>
                <div style={{
                  fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                  color: detailMode === "rejection" ? "var(--error-700)" : "var(--neutral-500)",
                  marginBottom: "var(--space-2)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <FileText size={12} />
                  {detailMode === "reason" ? "Employee's reason" : "Manager's comment"}
                </div>
                <p style={{ fontSize: "0.9375rem", color: "var(--neutral-800)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                  {detailMode === "reason"
                    ? (detailRequest.reason || "No reason provided.")
                    : (detailRequest.manager_comment || "No comment provided.")}
                </p>
              </div>
            </div>

            <div className="modal__footer">
              <button
                className="btn btn--secondary"
                onClick={() => { setDetailRequest(null); setDetailMode(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirmation Modal ─────────────────────────── */}
      {cancelTarget && (
        <div className="modal-overlay" onClick={() => setCancelTarget(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Cancel leave request</div>
              <div className="modal__subtitle">This action cannot be undone. Are you sure you want to cancel this request?</div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setCancelTarget(null)}>Keep request</button>
              <button className="btn btn--primary" style={{ background: "var(--error-500)" }} onClick={handleConfirmCancel}>
                Yes, cancel it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Container ───────────────────────────────────── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <div style={{ flexShrink: 0, marginTop: 1 }}>
              {t.type === "success" && <CheckCircle2 size={16} color="var(--success-500)" />}
              {t.type === "error" && <XCircle size={16} color="var(--error-500)" />}
              {t.type === "warning" && <AlertTriangle size={16} color="var(--warning-500)" />}
            </div>
            <div className="toast__content">
              <div className="toast__title">{t.title}</div>
              {t.message && <div className="toast__message">{t.message}</div>}
            </div>
            <button className="toast__close" onClick={() => removeToast(t.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

    </DashboardLayout>
  );
};
