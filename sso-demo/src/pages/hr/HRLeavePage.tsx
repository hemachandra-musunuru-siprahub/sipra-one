import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Calendar, Search, Download } from "lucide-react";
import { getAllLeave } from "../../api/leave";
import type { LeaveRequest } from "../../api/types";

interface Props { internalUser: any; }

export const HRLeavePage = ({ internalUser }: Props) => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getAllLeave()
      .then(d => {
        if (!d || !d.requests) setErrorMsg("API response is missing requests array.");
        else setRequests(d.requests);
      })
      .catch(e => {
        console.error(e);
        setErrorMsg(e.message || "Failed to fetch leave requests");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = requests.filter(r => {
    const matchesSearch = (r.employee_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filter === "all" ? true : r.status === filter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout internalUser={internalUser} role="HR">
      <header className="page-header">
        <div className="breadcrumb"><span>HR</span><span className="breadcrumb__separator">/</span><span>Leave Requests</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Company Leave Overview</h1>
          <button className="btn btn--secondary"><Download size={16} /> Export Data</button>
        </div>
      </header>
      <div className="card">
        <div className="card__header">
          <h3 className="card__title"><Calendar size={18} style={{ marginRight: "var(--space-2)" }} /> All Leave Requests</h3>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <div className="topbar__search" style={{ border: "1px solid var(--neutral-200)", borderRadius: "var(--rounded-md)", padding: "0 var(--space-3)" }}>
              <Search size={16} color="var(--neutral-400)" />
              <input className="topbar__search-input" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input" style={{ width: 150 }} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Manager (OID)</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading leave data…</td></tr>
                : errorMsg ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--error-500)" }}>Error: {errorMsg}</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No leave requests found.</td></tr>
                : filtered.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <div className="avatar avatar--sm" style={{ width: 24, height: 24 }}>{(r.employee_name || "E")[0]}</div>
                        <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{r.employee_name || r.employee_oid.slice(0,8)}</span>
                      </div>
                    </td>
                    <td><span className="badge badge--hr">{r.leave_type}</span></td>
                    <td style={{ fontSize: "0.875rem" }}>{r.start_date} → {r.end_date}</td>
                    <td>{r.total_days}</td>
                    <td>
                      <span className={`badge ${r.status === "approved" ? "badge--published" : r.status === "rejected" ? "badge--urgent" : r.status === "cancelled" ? "badge--it" : "badge--draft"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--neutral-500)" }}>
                      {r.manager_oid ? r.manager_oid.slice(0, 12) + "…" : "—"}
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
