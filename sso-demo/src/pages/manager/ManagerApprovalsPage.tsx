import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  AlertTriangle,
  X,
  Inbox,
  Check,
  FileText,
} from "lucide-react";
import { getAllLeave, actionLeave } from "../../api/leave";
import type { LeaveRequest } from "../../api/types";
import { formatLeaveDates } from "../../utils/dateFormatter";

interface Props { internalUser: any; }

/* ─── Toast ─────────────────────────────────────────────── */
type ToastType = "success" | "error" | "warning";
interface Toast { id: number; type: ToastType; title: string; message?: string; }
let _toastId = 0;

/* ─── Helpers ───────────────────────────────────────────── */
const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Annual", sick: "Sick", unpaid: "Unpaid", other: "Other",
};

const statusClass = (s: string) => ({
  pending: "status-badge--pending",
  approved: "status-badge--approved",
  rejected: "status-badge--rejected",
  cancelled: "status-badge--cancelled",
}[s] ?? "status-badge--pending");

const leaveTypeDotClass = (t: string) =>
  ({ annual: "annual", sick: "sick", unpaid: "unpaid", other: "other" }[t] ?? "other");

const initials = (name: string) =>
  name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

/* ─── Skeleton row ──────────────────────────────────────── */
function TableSkeleton() {
  return (
    <>
      {[1, 2, 3].map(i => (
        <tr key={i}>
          <td colSpan={7} style={{ padding: 0, borderBottom: "1px solid var(--neutral-200)" }}>
            <div className="skeleton skeleton--row" style={{ margin: "4px 0" }} />
          </td>
        </tr>
      ))}
    </>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export const ManagerApprovalsPage = ({ internalUser }: Props) => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [detailRequest, setDetailRequest] = useState<LeaveRequest | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  /* ─── Toast helpers ── */
  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++_toastId;
    setToasts(t => [...t, { id, type, title, message }]);
    if (type !== "error") setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);
  const removeToast = (id: number) => setToasts(t => t.filter(x => x.id !== id));

  /* ─── Load ── */
  useEffect(() => {
    setLoading(true);
    getAllLeave()
      .then(data => {
        console.log(`[DEBUG] Loaded ${data.requests?.length || 0} leave requests from API.`);
        setLeaveRequests(data.requests || []);
      })
      .catch((err) => {
        console.error("Failed to load team leave:", err);
        addToast("error", "Failed to load team leave", "Please refresh the page.");
      })
      .finally(() => setLoading(false));
  }, []);

  /* ─── Approve ── */
  const handleApprove = async (id: string) => {
    const req = leaveRequests.find(r => r.id === id);
    try {
      const { request } = await actionLeave(id, "approved");
      // Merge only updated fields from backend to preserve existing fields like employee_name if they were missing in response
      setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, ...request } : r));
      addToast("success", "Leave approved", `Approved for ${request.employee_name || req?.employee_name || "employee"}.`);
    } catch (e: any) {
      addToast("error", "Could not approve", e.message);
    }
  };

  /* ─── Reject ── */
  const handleReject = async (id: string) => {
    if (!rejectReason.trim() || rejectReason.trim().length < 10) {
      setRejectError("Comment is required (minimum 10 characters)");
      return;
    }
    try {
      const { request } = await actionLeave(id, "rejected", rejectReason);
      setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, ...request } : r));
      const empName = request.employee_name || leaveRequests.find(r => r.id === id)?.employee_name || "employee";
      addToast("warning", "Leave rejected", `Rejection sent to ${empName}.`);
      setRejectingId(null);
      setRejectReason("");
      setRejectError("");
    } catch (e: any) {
      addToast("error", "Could not reject", e.message);
    }
  };

  /* ─── Derived ── */
  const filteredRequests = leaveRequests.filter(r =>
    filter === "all" ? true : r.status === filter
  );

  console.log(`[DEBUG] Rendering ${filteredRequests.length} rows. Filter: ${filter}. Total State Count: ${leaveRequests.length}`);

  const pendingCount  = leaveRequests.filter(r => r.status === "pending").length;
  const approvedCount = leaveRequests.filter(r => r.status === "approved").length;
  const rejectedCount = leaveRequests.filter(r => r.status === "rejected").length;

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <DashboardLayout internalUser={internalUser} role="Manager">

      {/* ── Page Header ──────────────────────────────────────── */}
      <header className="page-header">
        <div className="breadcrumb">
          <span>Manager</span>
          <ChevronRight size={14} className="breadcrumb__separator" />
          <span className="breadcrumb__current">Leave approvals</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <h1 className="page-title">Leave approvals</h1>
          {pendingCount > 0 && (
            <span className="status-badge status-badge--pending" style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px" }}>
              <Clock size={13} /> {pendingCount} pending
            </span>
          )}
        </div>
      </header>

      {/* ── Metric Cards ──────────────────────────────────────── */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
        <div className="metric-card metric-card--pending">
          <div className="metric-card__number">{loading ? "—" : pendingCount}</div>
          <div className="metric-card__label">Pending approval</div>
        </div>
        <div className="metric-card metric-card--approved">
          <div className="metric-card__number">{loading ? "—" : approvedCount}</div>
          <div className="metric-card__label">Approved</div>
        </div>
        <div className="metric-card metric-card--rejected">
          <div className="metric-card__number">{loading ? "—" : rejectedCount}</div>
          <div className="metric-card__label">Rejected</div>
        </div>
      </section>

      {/* ── Team Leave Requests Table ─────────────────────────── */}
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
              <UserCheck size={18} /> Team leave requests
            </span>
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--neutral-500)" }}>
              {leaveRequests.length} total
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tab-nav" style={{ padding: "0 var(--space-6)" }}>
          {filterTabs.map(t => (
            <button
              key={t.key}
              className={`tab-nav__item ${filter === t.key ? "tab-nav__item--active" : ""}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              {t.key !== "all" && (
                <span style={{
                  marginLeft: 6,
                  fontSize: "0.7rem",
                  background: filter === t.key ? "var(--primary-100)" : "var(--neutral-100)",
                  color: filter === t.key ? "var(--primary-700)" : "var(--neutral-500)",
                  borderRadius: "var(--rounded-full)",
                  padding: "1px 6px",
                  fontWeight: 600,
                }}>
                  {leaveRequests.filter(r => r.status === t.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table className="leave-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>Days</th>
                <th>Dates</th>
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
                  <td colSpan={7} style={{ border: "none", padding: 0 }}>
                    <div className="empty-state">
                      <Inbox size={48} className="empty-state__icon" />
                      <div className="empty-state__heading">
                        {filter === "pending" ? "No pending approvals" : `No ${filter !== "all" ? filter : ""} requests`}
                      </div>
                      <div className="empty-state__description">
                        {filter === "pending"
                          ? "Your team has no leave requests awaiting approval."
                          : "No leave requests match the selected filter."}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map(req => (
                  <tr key={req.id}>
                    {/* Employee */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <div className="emp-avatar">
                          {initials(req.employee_name || req.employee?.name || req.requester_name || "E")}
                        </div>
                        <span style={{ fontWeight: 500, color: "var(--neutral-800)", fontSize: "0.9375rem" }}>
                          {req.employee_name || req.employee?.name || req.requester_name || req.employee_oid?.slice(0, 8) || "Unknown Employee"}
                        </span>
                      </div>
                    </td>
                    {/* Type */}
                    <td>
                      <span className="leave-type-tag">
                        <span className={`leave-type-dot leave-type-dot--${leaveTypeDotClass(req.leave_type)}`} />
                        {LEAVE_TYPE_LABELS[req.leave_type] ?? req.leave_type}
                      </span>
                    </td>
                    {/* Days */}
                    <td style={{ fontWeight: 600, color: "var(--neutral-800)" }}>{req.total_days}</td>
                    {/* Dates */}
                    <td style={{ whiteSpace: "nowrap", fontSize: "0.875rem" }}>
                      {formatLeaveDates(req.start_date, req.end_date)}
                    </td>
                    {/* Reason */}
                    <td style={{ maxWidth: 160 }}>
                      {req.reason ? (
                        <button
                          onClick={() => setDetailRequest(req)}
                          style={{
                            background: "none", border: "none", cursor: "pointer", padding: 0,
                            color: "var(--primary-500)", fontSize: "0.8125rem", fontFamily: "inherit",
                            textAlign: "left", maxWidth: 160,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            display: "block", textDecoration: "underline", textUnderlineOffset: 2,
                          }}
                          title="View full reason"
                        >
                          {req.reason.length > 22 ? req.reason.slice(0, 22) + "…" : req.reason}
                        </button>
                      ) : (
                        <span style={{ color: "var(--neutral-300)" }}>—</span>
                      )}
                    </td>
                    {/* Status */}
                    <td>
                      <span className={`status-badge ${statusClass(req.status)}`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                      {req.status === "rejected" && req.manager_comment && (
                        <div style={{ fontSize: "0.75rem", color: "var(--neutral-400)", marginTop: 2 }}>
                          {req.manager_comment.slice(0, 30)}{req.manager_comment.length > 30 ? "…" : ""}
                        </div>
                      )}
                    </td>
                    {/* Actions */}
                    <td>
                      {req.status === "pending" ? (
                        <div style={{ display: "flex", gap: "var(--space-2)" }}>
                          <button
                            className="btn--approve"
                            onClick={() => handleApprove(req.id)}
                            title="Approve this request"
                          >
                            <Check size={13} /> Approve
                          </button>
                          <button
                            className="btn--reject"
                            onClick={() => { setRejectingId(req.id); setRejectReason(""); setRejectError(""); }}
                            title="Reject this request"
                          >
                            <X size={13} /> Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.8125rem", color: "var(--neutral-300)" }}>—</span>
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
      {detailRequest && (
        <div className="modal-overlay" onClick={() => setDetailRequest(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="modal__title">Leave request reason</div>
                <div className="modal__subtitle">Full details for this employee's leave request</div>
              </div>
              <button
                className="topbar__icon-btn"
                onClick={() => setDetailRequest(null)}
                aria-label="Close"
                style={{ marginLeft: "var(--space-4)", flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal__body">
              {/* Detail rows */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "var(--space-3) var(--space-4)", marginBottom: "var(--space-5)" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", fontWeight: 500 }}>Employee</span>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <div className="emp-avatar" style={{ width: 28, height: 28, fontSize: "0.75rem" }}>
                    {initials(detailRequest.employee_name || "E")}
                  </div>
                  <span style={{ fontWeight: 500, color: "var(--neutral-800)" }}>
                    {detailRequest.employee_name || detailRequest.employee?.name || detailRequest.requester_name || detailRequest.employee_oid?.slice(0, 8) || "Unknown Employee"}
                  </span>
                </div>

                <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", fontWeight: 500 }}>Leave type</span>
                <span className="leave-type-tag">
                  <span className={`leave-type-dot leave-type-dot--${leaveTypeDotClass(detailRequest.leave_type)}`} />
                  {LEAVE_TYPE_LABELS[detailRequest.leave_type] ?? detailRequest.leave_type}
                </span>

                <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", fontWeight: 500 }}>Dates</span>
                <span style={{ fontSize: "0.875rem", color: "var(--neutral-800)" }}>
                  {formatLeaveDates(detailRequest.start_date, detailRequest.end_date)}
                </span>

                <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", fontWeight: 500 }}>Days</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)" }}>{detailRequest.total_days}</span>
              </div>

              {/* Full reason text */}
              <div style={{
                background: "var(--neutral-50)",
                border: "1px solid var(--neutral-200)",
                borderRadius: "var(--rounded-md)",
                padding: "var(--space-4)",
              }}>
                <div style={{
                  fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
                  color: "var(--neutral-500)", marginBottom: "var(--space-2)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <FileText size={12} /> Employee's reason
                </div>
                <p style={{ fontSize: "0.9375rem", color: "var(--neutral-800)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                  {detailRequest.reason || "No reason provided."}
                </p>
              </div>
            </div>

            <div className="modal__footer">
              <button
                className="btn btn--secondary"
                onClick={() => setDetailRequest(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rejection Modal ────────────────────────────────────── */}
      {rejectingId && (
        <div
          className="modal-overlay"
          onClick={() => { setRejectingId(null); setRejectReason(""); setRejectError(""); }}
        >
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Reject leave request</div>
              <div className="modal__subtitle">
                Provide a reason for the employee —{" "}
                <strong>
                  {leaveRequests.find(r => r.id === rejectingId)?.employee_name ?? "this employee"}
                </strong>.
              </div>
            </div>
            <div className="modal__body">
              <div className="form-field">
                <label className="form-label form-label--required">Manager comment</label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Explain why this request is being rejected…"
                  value={rejectReason}
                  onChange={e => { setRejectReason(e.target.value); if (rejectError) setRejectError(""); }}
                  style={rejectError ? { borderColor: "var(--error-500)" } : {}}
                />
                {rejectError && (
                  <span className="form-error">
                    <AlertTriangle size={12} />{rejectError}
                  </span>
                )}
              </div>
            </div>
            <div className="modal__footer">
              <button
                className="btn btn--secondary"
                onClick={() => { setRejectingId(null); setRejectReason(""); setRejectError(""); }}
              >
                Cancel
              </button>
              <button
                className="btn btn--primary"
                style={{ background: "var(--error-500)" }}
                onClick={() => handleReject(rejectingId)}
              >
                Confirm rejection
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
              {t.type === "error"   && <XCircle      size={16} color="var(--error-500)" />}
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
