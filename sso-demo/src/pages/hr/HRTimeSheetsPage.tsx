import { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import {
  ClipboardList, Calendar, Search, Download, X, AlertCircle,
} from "lucide-react";
import { getHRTimesheets, exportHRTimesheetsCSV } from "../../api/timesheets";
import type { HRTimesheet } from "../../api/timesheets";
import { getUsers } from "../../api/users";
import type { User } from "../../api/types";

interface Props { internalUser: any; }

// ─── Status badge helper ──────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: HRTimesheet["status"] }) => {
  const cls =
    status === "reviewed"  ? "badge--published" :
    status === "submitted" ? "badge--it"        :
    "badge--draft";
  return (
    <span className={`badge ${cls}`} style={{ textTransform: "capitalize" }}>
      {status}
    </span>
  );
};

// ─── Date formatter ───────────────────────────────────────────────────────────
const fmt = (val: string | null): string => {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

export const HRTimeSheetsPage = ({ internalUser }: Props) => {
  // ── Filter state ─────────────────────────────────────────────────────────────
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedStatus,   setSelectedStatus]   = useState("all");
  const [selectedMonth,    setSelectedMonth]     = useState(
    () => new Date().toISOString().slice(0, 7)  // default: current YYYY-MM
  );
  const [monthEnabled, setMonthEnabled] = useState(false); // opt-in month filter

  // ── Data state ───────────────────────────────────────────────────────────────
  const [timesheets, setTimesheets] = useState<HRTimesheet[]>([]);
  const [employees,  setEmployees]  = useState<User[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [exporting,  setExporting]  = useState(false);
  const [exportErr,  setExportErr]  = useState<string | null>(null);

  // ── Search input (client-side filter on the loaded dataset) ──────────────────
  const [searchInput, setSearchInput] = useState("");

  // ── Load employee list once (for dropdown) ───────────────────────────────────
  useEffect(() => {
    getUsers()
      .then(d => setEmployees(d.users || []))
      .catch(console.error);
  }, []);

  // ── Fetch timesheets when filters change ─────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);

    getHRTimesheets({
      employeeOid: selectedEmployee !== "all" ? selectedEmployee : undefined,
      status:      selectedStatus   !== "all" ? selectedStatus   : undefined,
      month:       monthEnabled ? selectedMonth : undefined,
    })
      .then(d => setTimesheets(d.timesheets))
      .catch((e: Error) => setError(e.message || "Failed to load timesheets"))
      .finally(() => setLoading(false));
  }, [selectedEmployee, selectedStatus, selectedMonth, monthEnabled]);

  // Client-side safety net: even if a stale response contained drafts, never render them.
  const displayedTimesheets = timesheets.filter(ts => {
    if (ts.status === "draft") return false; // HR must never see draft
    if (!searchInput.trim()) return true;
    const q = searchInput.trim().toLowerCase();
    return (
      (ts.employee_name  || "").toLowerCase().includes(q) ||
      (ts.employee_email || "").toLowerCase().includes(q)
    );
  });

  // ── Export handler ───────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    setExportErr(null);
    try {
      await exportHRTimesheetsCSV(monthEnabled ? selectedMonth : undefined);
    } catch (e: any) {
      setExportErr(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const clearSearch = () => setSearchInput("");

  return (
    <DashboardLayout internalUser={internalUser} role="HR">
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div className="breadcrumb">
          <span>HR</span>
          <span className="breadcrumb__separator">/</span>
          <span>Timesheets</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">
            <ClipboardList size={24} style={{ marginRight: "var(--space-3)", verticalAlign: "middle" }} />
            Employee Timesheets
          </h1>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", fontStyle: "italic" }}>
              View &amp; Export Only
            </span>
            <button
              id="hr-export-csv-btn"
              className="btn btn--secondary"
              onClick={handleExport}
              disabled={exporting}
              title="Download all reviewed timesheets as CSV"
            >
              <Download size={16} />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Export error ─────────────────────────────────────────────────────── */}
      {exportErr && (
        <div
          className="card"
          style={{
            background: "rgba(239,68,68,0.08)", borderColor: "var(--error-500)",
            marginBottom: "var(--space-4)",
          }}
        >
          <div
            className="card__body"
            style={{
              color: "var(--error-600)", padding: "var(--space-3) var(--space-4)",
              display: "flex", gap: "var(--space-2)", alignItems: "center",
            }}
          >
            <AlertCircle size={18} />
            <strong>Export failed:</strong> {exportErr}
            <button
              onClick={() => setExportErr(null)}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main card ────────────────────────────────────────────────────────── */}
      <div className="card">
        {/* ── Filter bar ─────────────────────────────────────────────────────── */}
        <div
          className="card__header"
          style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "center" }}
        >
          <h3 className="card__title" style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <ClipboardList size={18} /> All Employee Timesheets
            {!loading && (
              <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--neutral-500)", marginLeft: "var(--space-2)" }}>
                ({displayedTimesheets.length} record{displayedTimesheets.length !== 1 ? "s" : ""})
              </span>
            )}
          </h3>

          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>

            {/* ── Free-text search ──────────────────────────────────────────── */}
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <Search
                size={15}
                style={{ position: "absolute", left: 10, color: "var(--neutral-400)", pointerEvents: "none" }}
              />
              <input
                id="hr-ts-search"
                type="text"
                className="input"
                placeholder="Search name or email…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                style={{ width: 210, height: 36, paddingLeft: 32, paddingRight: searchInput ? 32 : 12, fontSize: "0.875rem" }}
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  style={{ position: "absolute", right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--neutral-400)", display: "flex" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* ── Employee dropdown ──────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                Employee:
              </span>
              <select
                id="hr-ts-employee-filter"
                className="input"
                style={{ width: 180, height: 36, fontSize: "0.875rem" }}
                value={selectedEmployee}
                onChange={e => setSelectedEmployee(e.target.value)}
              >
                <option value="all">All Employees</option>
                {employees.map(u => (
                  <option key={u.entra_oid} value={u.entra_oid}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* ── Status dropdown ────────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase" }}>
                Status:
              </span>
              <select
                id="hr-ts-status-filter"
                className="input"
                style={{ width: 150, height: 36, fontSize: "0.875rem" }}
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
              >
                <option value="all">All (Submitted + Reviewed)</option>
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </div>

            {/* ── Month filter (opt-in) ──────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.8125rem", cursor: "pointer", color: "var(--neutral-600)", userSelect: "none" }}>
                <input
                  type="checkbox"
                  checked={monthEnabled}
                  onChange={e => setMonthEnabled(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <Calendar size={14} />
                Month:
              </label>
              <input
                id="hr-ts-month-filter"
                type="month"
                className="input"
                style={{ height: 36, fontSize: "0.875rem", width: 150, opacity: monthEnabled ? 1 : 0.4 }}
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                disabled={!monthEnabled}
              />
            </div>
          </div>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Week Start</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th>Submitted At</th>
                <th>Reviewed At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)", padding: "var(--space-10)" }}>
                    Loading timesheets…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--error-600)", padding: "var(--space-6)" }}>
                    <AlertCircle size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    {error}
                  </td>
                </tr>
              ) : displayedTimesheets.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)", padding: "var(--space-10)" }}>
                    No timesheets found for the current filters.
                  </td>
                </tr>
              ) : (
                displayedTimesheets.map(ts => (
                  <tr key={ts.id}>
                    {/* Employee */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <div
                          className="avatar avatar--sm"
                          style={{ width: 28, height: 28, fontSize: "0.75rem", flexShrink: 0 }}
                        >
                          {(ts.employee_name || "?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                            {ts.employee_name || "Unknown"}
                          </div>
                          {ts.employee_email && (
                            <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
                              {ts.employee_email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Week Start */}
                    <td style={{ fontSize: "0.875rem", whiteSpace: "nowrap" }}>
                      {fmt(ts.week_start_date)}
                    </td>

                    {/* Total Hours */}
                    <td>
                      <strong style={{ color: ts.total_hours > 0 ? "var(--primary-600)" : "var(--neutral-400)" }}>
                        {ts.total_hours}h
                      </strong>
                    </td>

                    {/* Status */}
                    <td>
                      <StatusBadge status={ts.status} />
                    </td>

                    {/* Submitted At */}
                    <td style={{ fontSize: "0.8125rem", color: "var(--neutral-600)" }}>
                      {fmt(ts.submitted_at)}
                    </td>

                    {/* Reviewed At */}
                    <td style={{ fontSize: "0.8125rem", color: "var(--neutral-600)" }}>
                      {fmt(ts.reviewed_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer info ────────────────────────────────────────────────────── */}
        <div className="card__footer">
          <p style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
            HR Admins have read-only access to <strong>submitted</strong> and <strong>reviewed</strong> timesheets only.
            Draft records remain private to employees.
            Use <strong>Export CSV</strong> to download reviewed timesheet data.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};
