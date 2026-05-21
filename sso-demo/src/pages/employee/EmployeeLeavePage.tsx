import React, { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";

import {
  Calendar,
  Plus,
  XCircle,
  AlertTriangle,
  X,
  Inbox,
  ChevronRight,
  FileText,
  Paperclip,
  Download,
  Upload,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  Sliders,
  Info,
} from "lucide-react";
import { getMyLeave, submitLeave, cancelLeave, getPaidLeaveBalance, getLeaveTransactions } from "../../api/leave";
import type { LeaveRequest, LeaveTransaction, PaidLeaveBalance } from "../../api/types";
import { formatLeaveDates } from "../../utils/dateFormatter";

interface Props { internalUser: any; role?: string; }

/* ─── Toast ─────────────────────────────────────────────── */
type ToastType = "success" | "error" | "warning";
interface Toast { id: number; type: ToastType; title: string; message?: string; }

let _toastId = 0;

/* ─── Helpers ───────────────────────────────────────────── */
const LEAVE_TYPE_LABELS: Record<string, string> = {
  casual: "Casual Leave (CL)", sick: "Sick Leave", unpaid: "Unpaid Leave",
};

// Calculate working days between two date strings
const calcWorkingDays = (start: string, end: string): number => {
  if (!start || !end) return 0;
  let count = 0;
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return 0;
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
};

// Today's date string for min date
const todayStr = () => new Date().toISOString().slice(0, 10);

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
  const [paidBalance, setPaidBalance] = useState<PaidLeaveBalance | null>(null);
  const [transactions, setTransactions] = useState<LeaveTransaction[]>([]);
  const [txFilter, setTxFilter] = useState<string>("ALL");
  const [showTxPanel, setShowTxPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    leaveType: "casual" as "casual" | "sick" | "unpaid",
    startDate: "", endDate: "", reason: "",
  });
  const [certFile, setCertFile] = useState<{ name: string; data: string; mime: string } | null>(null);
  const [certError, setCertError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [detailRequest, setDetailRequest] = useState<LeaveRequest | null>(null);
  const [detailMode, setDetailMode] = useState<"reason" | "rejection" | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  /* ─── Toast helpers ── */
  const addToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = ++_toastId;
    setToasts(t => [...t, { id, type, title, message }]);
    if (type !== "error") setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 5000);
  }, []);
  const removeToast = (id: number) => setToasts(t => t.filter(x => x.id !== id));

  const monthOptions = React.useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const val = `${year}-${month}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      options.push({ val, label });
    }
    return options;
  }, []);

  /* ─── Load data ── */
  const fetchData = useCallback(() => {
    Promise.all([
      getMyLeave(selectedMonth),
      getPaidLeaveBalance(),
      getLeaveTransactions({ limit: 50 }),
    ])
      .then(([lData, pbData, txData]) => {
        setRequests(lData.requests || []);
        setPaidBalance(pbData.balance || null);
        setTransactions(txData.transactions || []);
      })
      .catch((err) => {
        console.error("Failed to load leave data:", err);
        addToast("error", "Failed to load leave data", "Please refresh the page.");
      })
      .finally(() => setLoading(false));
  }, [addToast, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.startDate) errs.startDate = "Start date is required";
    if (!form.endDate) errs.endDate = "End date is required";
    if (form.startDate && form.endDate && form.startDate > form.endDate)
      errs.endDate = "End date must be after start date";
    if (form.startDate && form.startDate < todayStr())
      errs.startDate = "Start date cannot be in the past";
    if ((form.leaveType === "sick" || form.leaveType === "unpaid") && !form.reason.trim())
      errs.reason = "Reason is required for this leave type";
    if (computedDays === 0 && form.startDate && form.endDate)
      errs.endDate = "Selected dates have no working days";
    return errs;
  };

  /* ─── Submit ── */
  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!ALLOWED.includes(file.type)) {
      setCertError("Only PDF, JPG, or PNG files are allowed.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setCertError("File must be under 5 MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setCertError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCertFile({ name: file.name, data: dataUrl, mime: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const payload: Parameters<typeof submitLeave>[0] = {
        leaveType: form.leaveType as any,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || undefined,
      };
      if (form.leaveType === "sick" && certFile) {
        payload.medicalCertificateName = certFile.name;
        payload.medicalCertificateData = certFile.data;
        payload.medicalCertificateMime = certFile.mime;
      }
      const { request } = await submitLeave(payload);
      setRequests(prev => [request, ...prev]);
      setForm({ leaveType: "casual", startDate: "", endDate: "", reason: "" });
      setCertFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setShowForm(false);
      fetchData();
      const isAutoApproved = (isHRRole || isManagerRole) && !internalUser?.manager_entra_oid;
      addToast(
        "success",
        isAutoApproved ? "Leave auto-approved ✅" : "Request submitted",
        isAutoApproved ? "Your leave has been automatically approved." : "Your manager has been notified."
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

  const casualBalance = Number(paidBalance?.available_balance ?? 0);
  const isLowBalance = form.leaveType === "casual" && paidBalance && casualBalance <= 2 && casualBalance > 0;
  const isZeroBalance = form.leaveType === "casual" && casualBalance === 0;
  const computedDays = calcWorkingDays(form.startDate, form.endDate);

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
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase" }}>Month:</span>
            <select 
              className="input" 
              style={{ width: 160, height: "32px", fontSize: "0.8125rem" }} 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)}
            >
              <option value="">All Time</option>
              {monthOptions.map(opt => (
                <option key={opt.val} value={opt.val}>{opt.label}</option>
              ))}
            </select>
          </div>
          <button className="btn btn--primary" onClick={() => setShowForm(true)} style={{ height: "32px", fontSize: "0.8125rem", padding: "0 var(--space-3)" }}>
            <Plus size={16} /> Apply for Leave
          </button>
        </div>
      </header>

      {/* ── Paid Leave Balance Card ──────────────────────────── */}
      <section style={{ marginBottom: "var(--space-5)" }}>
        <div style={{
          background: "white",
          border: "1px solid var(--neutral-200)",
          borderRadius: "12px",
          boxShadow: "var(--shadow-sm)",
          padding: "20px 24px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--neutral-500)", letterSpacing: "0.04em", marginBottom: 4 }}>
                  Casual Leave Balance
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: "36px", fontWeight: 800, color: "var(--primary-500)", lineHeight: 1 }}>
                    {loading ? "—" : Number(paidBalance?.available_balance ?? 0).toFixed(1)}
                  </span>
                  <span style={{ fontSize: "14px", color: "var(--neutral-500)", fontWeight: 600 }}>days available</span>
                </div>
                <div style={{ fontSize: "11px", color: "var(--neutral-400)", marginTop: 4 }}>
                  Casual Leave: +1 day credited on the 1st of every month · Resets Dec 31
                </div>
              </div>
              <button
                onClick={() => setShowTxPanel(v => !v)}
                style={{
                  background: showTxPanel ? "var(--primary-50, #fef2f2)" : "white",
                  border: `1px solid ${showTxPanel ? "var(--primary-300)" : "var(--neutral-200)"}`,
                  borderRadius: "6px", padding: "6px 12px", cursor: "pointer",
                  fontSize: "12px", fontWeight: 600,
                  color: showTxPanel ? "var(--primary-600)" : "var(--neutral-600)",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <FileText size={13} /> Transaction History
              </button>
            </div>



            {/* Year-end expiry notice */}
            {paidBalance && Number(paidBalance.available_balance) > 0 && (
              <div style={{
                marginTop: 12,
                padding: "8px 12px",
                background: "#FFFBEB",
                border: "1px solid #FEF3C7",
                borderRadius: "6px",
                display: "flex", alignItems: "center", gap: 8,
                fontSize: "11px", color: "#92400E",
              }}>
                <Info size={13} />
                Your unused balance of <strong>{Number(paidBalance.available_balance).toFixed(1)} day(s)</strong> will expire on December 31st. Use it before year-end!
              </div>
            )}
          </div>
        </section>

      {/* ── Transaction History Panel ─────────────────────────── */}
      {showTxPanel && (
        <section style={{ marginBottom: "var(--space-5)" }}>
          <div style={{
            background: "white",
            border: "1px solid var(--neutral-200)",
            borderRadius: "12px",
            boxShadow: "var(--shadow-sm)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--neutral-100)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "var(--neutral-50)",
            }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--neutral-700)" }}>Leave Transaction Ledger</span>
              <div style={{ display: "flex", gap: 6 }}>
                {(["ALL", "CREDIT", "DEBIT", "EXPIRE", "ADJUSTMENT"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTxFilter(t)}
                    style={{
                      background: txFilter === t ? "var(--primary-500)" : "white",
                      color: txFilter === t ? "white" : "var(--neutral-600)",
                      border: `1px solid ${txFilter === t ? "transparent" : "var(--neutral-200)"}`,
                      borderRadius: "4px", padding: "3px 8px",
                      fontSize: "10px", fontWeight: 700, cursor: "pointer",
                      textTransform: "uppercase",
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {transactions.filter(tx => txFilter === "ALL" || tx.transaction_type === txFilter).length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "var(--neutral-400)", fontSize: "13px" }}>
                  <Inbox size={32} style={{ margin: "0 auto 8px", display: "block", color: "var(--neutral-200)" }} />
                  No transactions found
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--neutral-50)" }}>
                      <th style={{ padding: "8px 16px", textAlign: "left", fontWeight: 700, color: "var(--neutral-500)", fontSize: "10px", textTransform: "uppercase" }}>Date</th>
                      <th style={{ padding: "8px 8px",  textAlign: "left", fontWeight: 700, color: "var(--neutral-500)", fontSize: "10px", textTransform: "uppercase" }}>Type</th>
                      <th style={{ padding: "8px 8px",  textAlign: "left", fontWeight: 700, color: "var(--neutral-500)", fontSize: "10px", textTransform: "uppercase" }}>Reason</th>
                      <th style={{ padding: "8px 16px", textAlign: "right", fontWeight: 700, color: "var(--neutral-500)", fontSize: "10px", textTransform: "uppercase" }}>Amount</th>
                      <th style={{ padding: "8px 16px", textAlign: "right", fontWeight: 700, color: "var(--neutral-500)", fontSize: "10px", textTransform: "uppercase" }}>Balance After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .filter(tx => txFilter === "ALL" || tx.transaction_type === txFilter)
                      .map(tx => {
                        const txColors: Record<string, { bg: string; text: string }> = {
                          CREDIT:     { bg: "var(--success-50)",  text: "var(--success-700)"  },
                          DEBIT:      { bg: "var(--error-50)",    text: "var(--error-700)"    },
                          EXPIRE:     { bg: "var(--neutral-100)", text: "var(--neutral-600)"  },
                          ADJUSTMENT: { bg: "var(--info-50)",     text: "var(--info-700)"     },
                        };
                        const c = txColors[tx.transaction_type] ?? txColors.ADJUSTMENT;
                        return (
                          <tr key={tx.id} style={{ borderBottom: "1px solid var(--neutral-100)" }}>
                            <td style={{ padding: "8px 16px", color: "var(--neutral-500)" }}>
                              {new Date(tx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </td>
                            <td style={{ padding: "8px 8px" }}>
                              <span style={{
                                background: c.bg, color: c.text,
                                padding: "2px 7px", borderRadius: "4px",
                                fontSize: "10px", fontWeight: 700,
                              }}>{tx.transaction_type}</span>
                            </td>
                            <td style={{ padding: "8px 8px", color: "var(--neutral-600)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {tx.reason || "—"}
                            </td>
                            <td style={{ padding: "8px 16px", textAlign: "right", fontWeight: 700,
                              color: tx.transaction_type === "CREDIT" ? "var(--success-600)" : tx.transaction_type === "DEBIT" ? "var(--error-600)" : "var(--neutral-600)"
                            }}>
                              {tx.transaction_type === "CREDIT" || tx.transaction_type === "ADJUSTMENT" ? "+" : "-"}{Number(tx.amount).toFixed(1)}
                            </td>
                            <td style={{ padding: "8px 16px", textAlign: "right", color: "var(--neutral-700)", fontWeight: 600 }}>
                              {tx.balance_after != null ? Number(tx.balance_after).toFixed(1) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </section>
      )}




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
              {/* Leave Type */}
              <div className="form-field--compact">
                <label className="form-label--compact">Leave Type</label>
                <select
                  className="form-select--compact"
                  value={form.leaveType}
                  onChange={e => setForm(f => ({ ...f, leaveType: e.target.value as any }))}
                >
                  <option value="casual">Casual Leave (CL)</option>
                  <option value="sick">Sick Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              {/* Casual Leave balance badge */}
              {form.leaveType === "casual" && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px",
                  background: isZeroBalance ? "#FEF2F2" : casualBalance <= 2 ? "#FFFBEB" : "#F0FDF4",
                  border: `1px solid ${isZeroBalance ? "#FCA5A5" : casualBalance <= 2 ? "#FDE68A" : "#BBF7D0"}`,
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: isZeroBalance ? "#991B1B" : casualBalance <= 2 ? "#92400E" : "#166534",
                }}>
                  {isZeroBalance ? <AlertTriangle size={13} /> : <Info size={13} />}
                  {isZeroBalance
                    ? "No Casual Leave balance available. You cannot apply for Casual Leave."
                    : `Available Casual Leave Balance: ${casualBalance.toFixed(1)} day(s)`}
                </div>
              )}

              {/* Dates */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <div className="form-field--compact">
                  <label className="form-label--compact">Start Date</label>
                  <input
                    type="date"
                    className={`form-input--compact ${fieldErrors.startDate ? "border-error" : ""}`}
                    value={form.startDate}
                    min={todayStr()}
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
                    min={form.startDate || todayStr()}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  />
                  {fieldErrors.endDate && <div className="form-error">{fieldErrors.endDate}</div>}
                </div>
              </div>

              {/* Day count */}
              {computedDays > 0 && (
                <div style={{
                  padding: "6px 12px",
                  background: "var(--primary-50, #eff6ff)",
                  border: "1px solid var(--primary-100, #dbeafe)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "var(--primary-700, #1d4ed8)",
                  fontWeight: 600,
                }}>
                  Duration: {computedDays} working day{computedDays !== 1 ? "s" : ""}
                </div>
              )}

              {/* Reason */}
              <div className="form-field--compact">
                <label className="form-label--compact">
                  Reason {(form.leaveType === "sick" || form.leaveType === "unpaid") ? <span style={{ color: "var(--error-500)" }}>*</span> : "(Optional)"}
                </label>
                <textarea
                  className={`form-textarea--compact ${fieldErrors.reason ? "border-error" : ""}`}
                  placeholder={form.leaveType === "sick" ? "Describe your illness or medical reason..." : form.leaveType === "unpaid" ? "Reason for unpaid leave..." : "Tell us why you're taking leave..."}
                  value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                />
                {fieldErrors.reason && <div className="form-error">{fieldErrors.reason}</div>}
              </div>

              {/* Medical Certificate (Sick Leave) */}
              {form.leaveType === "sick" && (
                <div className="form-field--compact">
                  <label className="form-label--compact" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Paperclip size={13} /> Medical Certificate
                    <span style={{ fontSize: "0.65rem", color: "var(--neutral-400)", fontWeight: 400 }}>(PDF, JPG, PNG · max 5 MB)</span>
                  </label>
                  {certFile ? (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px",
                      background: "var(--neutral-50)",
                      border: "1px solid var(--neutral-200)",
                      borderRadius: "var(--rounded-md)",
                    }}>
                      <FileText size={14} color="var(--primary-600)" />
                      <span style={{ flex: 1, fontSize: "0.8rem", color: "var(--neutral-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {certFile.name}
                      </span>
                      <button type="button" onClick={() => { setCertFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 2, lineHeight: 0 }}>
                        <X size={13} color="var(--neutral-400)" />
                      </button>
                    </div>
                  ) : (
                    <label style={{
                      display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                      padding: "8px 12px", background: "var(--neutral-50)",
                      border: "1px dashed var(--neutral-200)", borderRadius: "var(--rounded-md)",
                      color: "var(--neutral-500)", fontSize: "0.8rem",
                    }}>
                      <Upload size={14} /> Click to upload certificate
                      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: "none" }} onChange={handleCertFileChange} />
                    </label>
                  )}
                  {certError && <div className="form-error" style={{ marginTop: 4, fontSize: "0.75rem" }}>{certError}</div>}
                </div>
              )}

              {/* Unpaid leave notice */}
              {form.leaveType === "unpaid" && (
                <div style={{
                  padding: "8px 12px", background: "#FFF7ED",
                  border: "1px solid #FED7AA", borderRadius: "6px",
                  fontSize: "11px", color: "#9A3412",
                }}>
                  <strong>Unpaid Leave</strong> — This leave will be marked as unpaid in payroll. No balance deduction required.
                </div>
              )}
            </div>

            <div className="drawer__footer">
              <button
                className="btn btn--primary"
                style={{ flex: 1, opacity: isZeroBalance ? 0.5 : 1 }}
                onClick={handleSubmit}
                disabled={submitting || isZeroBalance}
              >
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
              {/* Attachment download (Sick Leave) */}
              {detailMode === "reason" && detailRequest.medical_certificate_data && (
                <div style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  background: "var(--primary-50, #eff6ff)",
                  border: "1px solid var(--primary-100, #dbeafe)",
                  borderRadius: "var(--rounded-md)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <FileText size={16} color="var(--primary-600)" />
                  <span style={{ flex: 1, fontSize: "0.8rem", color: "var(--neutral-700)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {detailRequest.medical_certificate_name || "Medical Certificate"}
                  </span>
                  <a
                    href={detailRequest.medical_certificate_data}
                    download={detailRequest.medical_certificate_name || "medical_certificate"}
                    style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "var(--primary-600)", textDecoration: "none", fontWeight: 600 }}
                  >
                    <Download size={13} /> Download
                  </a>
                </div>
              )}
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

