import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Search, HelpCircle } from "lucide-react";
import { getAllLeave } from "../../api/leave";
import type { LeaveRequest } from "../../api/types";
import { formatLeaveDates } from "../../utils/dateFormatter";

interface Props { internalUser: any; }
interface EnrichedLeaveRequest extends LeaveRequest { manager_name?: string; }

export const HRLeavePage = ({ internalUser }: Props) => {
  const [requests, setRequests] = useState<EnrichedLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      options.push({ val: `${year}-${month}`, label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }) });
    }
    return options;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    getAllLeave(selectedMonth, filter, searchTerm)
      .then(d => setRequests(d.requests || []))
      .catch(e => setErrorMsg(e.message || "Failed to load leave data"))
      .finally(() => setLoading(false));
  }, [selectedMonth, filter, searchTerm]);

  const roles = internalUser?.roles || [];
  const isAdminRole = roles.includes("Admin") || roles.includes("SipraHub-SystemAdmin");
  const isManagerRole = roles.includes("Manager") || roles.includes("SipraHub-Manager");
  const pageTitle = isManagerRole && !isAdminRole ? "My Team Leave Requests" : "Leave Administration";

  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "HR"}>
      <header className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">{pageTitle}</h1>
        </div>
      </header>

      {errorMsg && (
        <div className="card" style={{ background: "rgba(239,68,68,0.1)", borderColor: "var(--error-500)", marginBottom: "var(--space-4)" }}>
          <div className="card__body" style={{ color: "var(--error-600)", padding: "var(--space-4)", display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <HelpCircle size={20} /> <strong>Error:</strong> {errorMsg}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">
            {isManagerRole && !isAdminRole ? "My Team's Requests" : "Employee Requests"}
          </h3>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <div className="topbar__search">
              <Search size={16} color="var(--neutral-400)" />
              <input className="topbar__search-input" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase" }}>Month:</span>
              <select className="input" style={{ width: 160, height: 38, fontSize: "0.875rem" }} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
                <option value="">All Time</option>
                {monthOptions.map(opt => <option key={opt.val} value={opt.val}>{opt.label}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase" }}>Status:</span>
              <select className="input" style={{ width: 140, height: 38, fontSize: "0.875rem" }} value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Manager</th></tr></thead>
            <tbody>
              {loading
                ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading leave data…</td></tr>
                : requests.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No leave requests found.</td></tr>
                  : requests.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <div className="avatar avatar--sm" style={{ width: 24, height: 24 }}>{(r.employee_name || "E")[0]}</div>
                          <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{r.employee_name || r.employee_oid.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td><span className="badge badge--hr" style={{ textTransform: "capitalize" }}>{r.leave_type} Leave</span></td>
                      <td style={{ fontSize: "0.875rem" }}>{formatLeaveDates(r.start_date, r.end_date)}</td>
                      <td>{r.total_days}</td>
                      <td>
                        <span className={`badge ${r.status === "approved" ? "badge--published" : r.status === "rejected" ? "badge--urgent" : r.status === "cancelled" ? "badge--it" : "badge--draft"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.875rem", color: "var(--neutral-600)" }}>
                        {r.manager_name || (r.manager_oid ? r.manager_oid.slice(0, 12) + "…" : "—")}
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};
