import React, { useState, useEffect, useCallback, useMemo } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  AlertTriangle,
  X,
  Inbox,
  Check,
  FileText,
  Search,
  Users,
  Download,
  Paperclip,
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
  annual: "Annual", sick: "Sick", casual: "Casual", unpaid: "Unpaid", other: "Other",
};

const statusClass = (s: string) => ({
  pending: "status-badge--pending",
  approved: "status-badge--approved",
  rejected: "status-badge--rejected",
  cancelled: "status-badge--cancelled",
}[s] ?? "status-badge--pending");

const leaveTypeDotClass = (t: string) =>
  ({ annual: "annual", sick: "sick", casual: "casual", unpaid: "unpaid", other: "other" }[t] ?? "other");

const initials = (name: string) =>
  name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();

/* ─── Skeleton row ──────────────────────────────────────── */
function TableSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
        <tr key={i}>
          <td colSpan={7} style={{ padding: "10px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="skeleton" style={{ width: 28, height: 28, borderRadius: "50%" }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: "35%", height: 10 }} />
              </div>
            </div>
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
  
  // Filters State
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  
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
  const fetchData = useCallback(() => {
    setLoading(true);
    getAllLeave()
      .then(data => {
        setLeaveRequests(data.requests || []);
      })
      .catch((err) => {
        console.error("Failed to load team leave:", err);
        addToast("error", "Failed to load team leave", "Please refresh the page.");
      })
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ─── Approve ── */
  const handleApprove = async (id: string) => {
    const req = leaveRequests.find(r => r.id === id);
    try {
      const { request } = await actionLeave(id, "approved");
      setLeaveRequests(prev => prev.map(r => r.id === id ? { ...r, ...request } : r));
      addToast("success", "Leave approved", `Approved for ${request.employee_name || req?.employee_name || "employee"}.`);
    } catch (e: any) {
      addToast("error", "Could not approve", e.message);
    }
  };

  /* ─── Reject ── */
  const handleReject = async (id: string) => {
    if (!rejectReason.trim() || rejectReason.trim().length < 5) {
      setRejectError("Comment is required (minimum 5 characters)");
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
  const filteredRequests = useMemo(() => {
    return leaveRequests.filter(r => {
      const matchesStatus = statusFilter === "all" ? true : r.status === statusFilter;
      const matchesType = typeFilter === "all" ? true : r.leave_type === typeFilter;
      const matchesSearch = (r.employee_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (r.reason || "").toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [leaveRequests, statusFilter, typeFilter, searchQuery]);

  const pendingCount  = leaveRequests.filter(r => r.status === "pending").length;
  const approvedCount = leaveRequests.filter(r => r.status === "approved").length;
  const rejectedCount = leaveRequests.filter(r => r.status === "rejected").length;

  const tabs: { key: typeof statusFilter; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: pendingCount },
    { key: "approved", label: "Approved", count: approvedCount },
    { key: "rejected", label: "Rejected", count: rejectedCount },
  ];

  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "Manager"}>

      {/* ── Page Header ──────────────────────────────────────── */}
      <header className="page-header" style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 className="page-title" style={{ fontSize: "1.25rem", margin: 0 }}>Leave Approvals</h1>
            {pendingCount > 0 && (
              <span className="status-badge status-badge--pending" style={{ fontSize: "0.65rem", padding: "1px 8px" }}>
                {pendingCount} Pending Action
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
             <button className="btn btn--secondary btn--sm" onClick={fetchData} title="Refresh data">
               Refresh
             </button>
          </div>
        </div>
      </header>

      {/* ── KPI Grid ────────────────────────────────────────── */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-5)" }}>
        <div className="kpi-card--modern kpi--pending">
          <div className="kpi-card__icon-wrap"><Clock size={20} /></div>
          <div className="kpi-card__info">
            <div className="kpi-card__val">{loading ? "—" : pendingCount}</div>
            <div className="kpi-card__lbl">Awaiting Action</div>
          </div>
        </div>
        <div className="kpi-card--modern kpi--approved">
          <div className="kpi-card__icon-wrap"><CheckCircle2 size={20} /></div>
          <div className="kpi-card__info">
            <div className="kpi-card__val">{loading ? "—" : approvedCount}</div>
            <div className="kpi-card__lbl">Approved this period</div>
          </div>
        </div>
        <div className="kpi-card--modern kpi--rejected">
          <div className="kpi-card__icon-wrap"><XCircle size={20} /></div>
          <div className="kpi-card__info">
            <div className="kpi-card__val">{loading ? "—" : rejectedCount}</div>
            <div className="kpi-card__lbl">Rejected requests</div>
          </div>
        </div>
        <div className="kpi-card--modern kpi--total">
          <div className="kpi-card__icon-wrap"><Users size={20} /></div>
          <div className="kpi-card__info">
            <div className="kpi-card__val">{loading ? "—" : leaveRequests.length}</div>
            <div className="kpi-card__lbl">Total Requests</div>
          </div>
        </div>
      </section>

      {/* ── Main Content Area ────────────────────────────────── */}
      <div className="card" style={{ border: "1px solid var(--neutral-100)", overflow: "visible" }}>
        
        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="segmented-control">
            {tabs.map(t => (
              <button
                key={t.key}
                className={`segmented-control__item ${statusFilter === t.key ? "segmented-control__item--active" : ""}`}
                onClick={() => setStatusFilter(t.key)}
              >
                {t.label}
                <span className="segmented-control__count">{t.count}</span>
              </button>
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: "var(--space-3)", flex: 1, justifyContent: "flex-end" }}>
            <div className="search-input-wrapper" style={{ maxWidth: 300 }}>
              <Search size={16} />
              <input 
                className="search-input-modern" 
                placeholder="Search employee or reason..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <select 
              className="filter-select-modern"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              {Object.entries(LEAVE_TYPE_LABELS).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Area */}
        <div className="table-container--responsive" style={{ minHeight: "440px" }}>
          <table className="table-modern">
            <thead>
              <tr>
                <th style={{ width: "26%" }}>Employee</th>
                <th style={{ width: "12%" }}>Type</th>
                <th style={{ width: "8%" }}>Days</th>
                <th style={{ width: "18%" }}>Dates</th>
                <th style={{ width: "22%" }}>Reason</th>
                <th style={{ width: "10%" }}>Status</th>
                <th style={{ width: "80px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeleton />
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "64px 0", textAlign: "center" }}>
                    <div className="empty-state">
                      <Inbox size={32} color="var(--neutral-200)" style={{ margin: "0 auto 12px" }} />
                      <div style={{ fontWeight: 600, color: "var(--neutral-500)", fontSize: "0.875rem" }}>No requests found</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--neutral-400)", marginTop: 4 }}>Try adjusting your filters or search query.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map(req => (
                  <tr key={req.id}>
                    <td>
                      <div className="user-identity">
                        <div className="user-identity__avatar">
                          {initials(req.employee_name || "E")}
                        </div>
                        <div className="user-identity__name" title={req.employee_name}>{req.employee_name || "Unknown Employee"}</div>
                      </div>
                    </td>
                    <td>
                      <span className="leave-type-tag" style={{ border: "none", padding: 0 }}>
                        <span className={`leave-type-dot leave-type-dot--${leaveTypeDotClass(req.leave_type)}`} />
                        <span style={{ color: "var(--neutral-700)", fontWeight: 500 }}>
                          {LEAVE_TYPE_LABELS[req.leave_type] ?? req.leave_type}
                        </span>
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--neutral-800)" }}>
                      {req.total_days}
                      <span style={{ fontSize: "0.65rem", color: "var(--neutral-400)", marginLeft: 1.5, fontWeight: 500 }}>d</span>
                    </td>
                    <td>
                      <div style={{ color: "var(--neutral-600)", fontWeight: 500 }}>
                        {formatLeaveDates(req.start_date, req.end_date)}
                      </div>
                    </td>
                    <td>
                      <div className="truncate-cell" title={req.reason || undefined}>
                        <button
                          className="link-btn"
                          onClick={() => setDetailRequest(req)}
                          style={{ 
                            fontSize: "inherit", 
                            color: "var(--neutral-500)", 
                            textAlign: "left",
                            textDecoration: "none",
                            width: "100%",
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {req.reason || <span style={{ color: "var(--neutral-300)", fontStyle: "italic" }}>No reason provided</span>}
                        </button>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${statusClass(req.status)}`} style={{ fontSize: "0.625rem", padding: "1px 6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                        {req.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-group">
                        {req.status === "pending" ? (
                          <>
                            <button 
                              className="btn-action-ghost btn-action-ghost--success" 
                              onClick={() => handleApprove(req.id)}
                              title="Approve Request"
                            >
                              <Check size={14} strokeWidth={2.5} />
                            </button>
                            <button 
                              className="btn-action-ghost btn-action-ghost--danger" 
                              onClick={() => { setRejectingId(req.id); setRejectReason(""); setRejectError(""); }}
                              title="Reject Request"
                            >
                              <X size={14} strokeWidth={2.5} />
                            </button>
                          </>
                        ) : (
                          <button 
                            className="btn-action-ghost" 
                            onClick={() => setDetailRequest(req)}
                            title="View Full Details"
                          >
                            <ChevronRight size={14} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination / Footer */}
        <div className="card__footer" style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          padding: "8px 16px", 
          background: "#fcfcfc",
          borderTop: "1px solid var(--neutral-100)"
        }}>
          <div style={{ fontSize: "0.725rem", color: "var(--neutral-500)", fontWeight: 500 }}>
            Showing <span style={{ color: "var(--neutral-900)", fontWeight: 700 }}>{filteredRequests.length}</span> results 
            {searchQuery && <span> for "<span style={{ color: "var(--primary-600)" }}>{searchQuery}</span>"</span>}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn--secondary btn--sm" style={{ height: 28, fontSize: "0.75rem", padding: "0 10px" }} disabled>Previous</button>
            <button className="btn btn--secondary btn--sm" style={{ height: 28, fontSize: "0.75rem", padding: "0 10px" }} disabled>Next</button>
          </div>
        </div>
      </div>

      {/* ── Leave Detail Modal ────────────────────────────────── */}
      {detailRequest && (
        <div className="modal-overlay" onClick={() => setDetailRequest(null)}>
          <div className="modal" style={{ maxWidth: 480, borderRadius: 12 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header" style={{ padding: "20px 24px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
                <div>
                  <div className="modal__title" style={{ fontSize: "1.125rem" }}>Request Details</div>
                  <div className="modal__subtitle">Full context for this leave application</div>
                </div>
                <button className="btn-action-ghost" onClick={() => setDetailRequest(null)}><X size={16} /></button>
              </div>
            </div>

            <div className="modal__body" style={{ padding: "0 24px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "12px 16px", marginBottom: "20px" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Employee</span>
                <div className="user-identity">
                  <div className="user-identity__avatar" style={{ width: 24, height: 24, fontSize: "0.65rem" }}>
                    {initials(detailRequest.employee_name || "E")}
                  </div>
                  <span style={{ fontWeight: 700, color: "var(--neutral-800)", fontSize: "0.875rem" }}>{detailRequest.employee_name}</span>
                </div>

                <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Type</span>
                <span className="leave-type-tag" style={{ border: "none", padding: 0 }}>
                  <span className={`leave-type-dot leave-type-dot--${leaveTypeDotClass(detailRequest.leave_type)}`} />
                  <span style={{ fontSize: "0.875rem", color: "var(--neutral-700)", fontWeight: 600 }}>
                    {LEAVE_TYPE_LABELS[detailRequest.leave_type] ?? detailRequest.leave_type}
                  </span>
                </span>

                <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Duration</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--neutral-900)" }}>{detailRequest.total_days} days</span>

                <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>Period</span>
                <span style={{ fontSize: "0.875rem", color: "var(--neutral-800)", fontWeight: 500 }}>{formatLeaveDates(detailRequest.start_date, detailRequest.end_date)}</span>
              </div>

              <div style={{ background: "var(--neutral-50)", padding: "16px", borderRadius: "10px", border: "1px solid var(--neutral-100)" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", color: "var(--neutral-400)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.05em" }}>
                  <FileText size={12} /> Reason for request
                </div>
                <p style={{ fontSize: "0.875rem", color: "var(--neutral-800)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", fontWeight: 500 }}>
                  {detailRequest.reason || "No reason provided."}
                </p>
              </div>
              
              {detailRequest.status === "rejected" && detailRequest.manager_comment && (
                <div style={{ background: "var(--error-50)", padding: "16px", borderRadius: "10px", border: "1px solid var(--error-100)", marginTop: 16 }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", color: "var(--error-600)", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, letterSpacing: "0.05em" }}>
                    <AlertTriangle size={12} /> Manager's Comment
                  </div>
                  <p style={{ fontSize: "0.8125rem", color: "var(--error-700)", lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                    {detailRequest.manager_comment}
                  </p>
                </div>
              )}

              {/* ── Medical Certificate Attachment ── */}
              {detailRequest.medical_certificate_data && (
                <div style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "var(--primary-50, #eff6ff)",
                  border: "1px solid var(--primary-100, #dbeafe)",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}>
                  <Paperclip size={16} color="var(--primary-600)" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", color: "var(--primary-600)", marginBottom: 2, letterSpacing: "0.05em" }}>
                      Medical Certificate
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--neutral-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {detailRequest.medical_certificate_name || "Attached document"}
                    </div>
                  </div>
                  <a
                    href={detailRequest.medical_certificate_data}
                    download={detailRequest.medical_certificate_name || "medical_certificate"}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 12px",
                      background: "var(--primary-600)",
                      color: "#fff",
                      borderRadius: 6,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      textDecoration: "none",
                      flexShrink: 0,
                    }}
                  >
                    <Download size={12} /> Download
                  </a>
                </div>
              )}
            </div>

            <div className="modal__footer" style={{ padding: "16px 24px", background: "var(--neutral-50)", borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
              <button className="btn btn--secondary btn--sm" onClick={() => setDetailRequest(null)}>Close</button>
              {detailRequest.status === "pending" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn--secondary btn--sm" style={{ color: "var(--error-600)", fontWeight: 600 }} onClick={() => { setRejectingId(detailRequest.id); setDetailRequest(null); }}>Reject</button>
                  <button className="btn btn--primary btn--sm" onClick={() => { handleApprove(detailRequest.id); setDetailRequest(null); }}>Approve Request</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Rejection Modal ────────────────────────────────────── */}
      {rejectingId && (
        <div className="modal-overlay" onClick={() => { setRejectingId(null); setRejectReason(""); setRejectError(""); }}>
          <div className="modal" style={{ maxWidth: 400, borderRadius: 16, boxShadow: "var(--shadow-xl)" }} onClick={e => e.stopPropagation()}>
            <div className="modal__header" style={{ padding: "24px 24px 16px" }}>
              <div className="modal__title" style={{ fontSize: "1.125rem", color: "var(--neutral-900)" }}>Reject Leave Request</div>
              <div className="modal__subtitle">Provide a valid reason for the employee</div>
            </div>
            <div className="modal__body" style={{ padding: "0 24px 20px" }}>
              <div className="form-field--compact">
                <label className="form-label--compact" style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", color: "var(--neutral-400)", marginBottom: 8, letterSpacing: "0.05em", display: "block" }}>
                  Rejection Reason <span style={{ color: "var(--error-500)" }}>*</span>
                </label>
                <textarea
                  className={`form-textarea--compact ${rejectError ? "border-error" : ""}`}
                  rows={3}
                  placeholder="Example: Insufficient coverage for the team during these dates..."
                  value={rejectReason}
                  onChange={e => { setRejectReason(e.target.value); if (rejectError) setRejectError(""); }}
                  style={{ minHeight: "88px", fontSize: "0.875rem", borderRadius: 10, padding: "12px", lineHeight: "1.5" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  {rejectError ? (
                    <div className="form-error" style={{ fontSize: "0.75rem", display: "flex", alignItems: "center", gap: 4 }}>
                      <AlertTriangle size={12} /> {rejectError}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.7rem", color: "var(--neutral-400)" }}>Min. 5 characters required</div>
                  )}
                  <div style={{ fontSize: "0.7rem", color: rejectReason.length < 5 ? "var(--neutral-400)" : "var(--success-600)", fontWeight: 600 }}>
                    {rejectReason.length} characters
                  </div>
                </div>
              </div>
            </div>
            <div className="modal__footer" style={{ padding: "16px 24px", background: "var(--neutral-50)", borderBottomLeftRadius: 16, borderBottomRightRadius: 16, display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button 
                className="btn btn--secondary" 
                style={{ height: 38, padding: "0 18px" }}
                onClick={() => { setRejectingId(null); setRejectReason(""); setRejectError(""); }}
              >
                Cancel
              </button>
              <button 
                className="btn btn--danger" 
                style={{ height: 38, padding: "0 18px" }}
                onClick={() => handleReject(rejectingId)}
                disabled={rejectReason.trim().length < 5}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toasts ── */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <div style={{ flexShrink: 0 }}>
              {t.type === "success" && <CheckCircle2 size={16} />}
              {t.type === "error" && <XCircle size={16} />}
              {t.type === "warning" && <AlertTriangle size={16} />}
            </div>
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

