import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import {
  Calendar, CheckCircle, Download, Eye, Search, X, AlertCircle,
} from "lucide-react";
import { getHRTimesheets, exportHRTimesheets } from "../../api/timesheets";
import type { HRTimesheet } from "../../api/timesheets";
import { getUsers } from "../../api/users";
import type { User } from "../../api/types";
import { formatDate } from "../../utils/dateFormatter";

interface Props { internalUser: any; }

// ─── Shared helpers ───────────────────────────────────────────────────────────
const fmt = (val: string | null): string => (!val ? "—" : formatDate(val));

const StatusBadge = ({ status }: { status: HRTimesheet["status"] }) => {
  const style: Record<string, React.CSSProperties> = {
    reviewed:  { background: "#ECFDF5", color: "#047857" },
    submitted: { background: "#EFF6FF", color: "#1D4ED8" },
    rejected:  { background: "#FEF2F2", color: "#991B1B" },
    draft:     { background: "var(--neutral-100)", color: "var(--neutral-500)" },
  };
  return (
    <span style={{
      ...style[status],
      padding: "2px 8px",
      borderRadius: "20px",
      fontSize: "0.6875rem",
      fontWeight: 600,
      textTransform: "capitalize",
    }}>
      {status}
    </span>
  );
};

// ─── Page ────────────────────────────────────────────────────────────────────
export const HRTimeSheetsPage = ({ internalUser }: Props) => {
  // ── Filter state ─────────────────────────────────────────────────────────────
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [selectedStatus,   setSelectedStatus]   = useState("all");
  const [selectedMonth,    setSelectedMonth]     = useState(
    () => new Date().toISOString().slice(0, 7)
  );

  // ── Search state (client-side) ───────────────────────────────────────────────
  const [searchInput,   setSearchInput]   = useState("");
  const [showDropdown,  setShowDropdown]  = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Data state ───────────────────────────────────────────────────────────────
  const [timesheets, setTimesheets] = useState<HRTimesheet[]>([]);
  const [employees,  setEmployees]  = useState<User[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [exporting,  setExporting]  = useState(false);
  const [exportErr,  setExportErr]  = useState<string | null>(null);

  // ── Detail modal state ───────────────────────────────────────────────────────
  const [selectedTs,  setSelectedTs]  = useState<HRTimesheet | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ── Load employee list once ───────────────────────────────────────────────────
  useEffect(() => {
    getUsers()
      .then(d => setEmployees(d.users || []))
      .catch(console.error);
  }, []);

  // ── Close search dropdown on outside click ───────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Fetch timesheets when filters change ──────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    getHRTimesheets({
      employeeOid: selectedEmployee !== "all" ? selectedEmployee : undefined,
      status:      selectedStatus   !== "all" ? selectedStatus   : undefined,
      month:       selectedMonth    !== ""    ? selectedMonth    : undefined,
    })
      .then(d => setTimesheets(d.timesheets))
      .catch((e: Error) => setError(e.message || "Failed to load timesheets"))
      .finally(() => setLoading(false));
  }, [selectedEmployee, selectedStatus, selectedMonth]);

  // ── Client-side search + draft filter ────────────────────────────────────────
  const displayedTimesheets = timesheets.filter(ts => {
    if (!searchInput.trim()) return true;
    const q = searchInput.trim().toLowerCase();
    return (
      (ts.employee_name  || "").toLowerCase().includes(q) ||
      (ts.employee_email || "").toLowerCase().includes(q)
    );
  });

  // ── Autocomplete suggestions ──────────────────────────────────────────────────
  const suggestions = employees.filter(u => {
    const q = searchInput.trim().toLowerCase();
    if (!q || selectedEmployee !== "all") return false;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const handleSelectSuggestion = (u: User) => {
    setSearchInput(u.name);
    setSelectedEmployee(u.entra_oid);
    setShowDropdown(false);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSelectedEmployee("all");
    setShowDropdown(false);
  };

  // ── Export ────────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    setExportErr(null);
    try {
      await exportHRTimesheets({
        employeeOid: selectedEmployee !== "all" ? selectedEmployee : undefined,
        status:      selectedStatus   !== "all" ? selectedStatus   : undefined,
        month:       selectedMonth    !== ""    ? selectedMonth    : undefined,
      });
    } catch (e: any) {
      setExportErr(e.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const submittedCount  = timesheets.filter(t => t.status === "submitted").length;
  const hasActiveSearch = searchInput.trim() !== "" || selectedEmployee !== "all";

  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "HR"}>

      {/* ── Page Header ── */}
      <header className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Employee Timesheets</h1>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--neutral-600)" }}>
              {submittedCount} awaiting review
            </span>

            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.875rem" }}>
              <Calendar size={16} style={{ color: "var(--neutral-500)" }} />
              <select
                className="input"
                style={{ height: 36, fontSize: "0.875rem", width: 150 }}
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              >
                <option value="">All Months</option>
                {/* Generate recent months */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const d = new Date();
                  d.setMonth(d.getMonth() - i);
                  const val = d.toISOString().slice(0, 7);
                  const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                  return <option key={val} value={val}>{label}</option>;
                })}
              </select>
            </label>

            <button
              className="btn btn--secondary"
              onClick={handleExport}
              disabled={exporting}
              title="Download all reviewed timesheets for selected month as Excel"
            >
              <Download size={16} />
              {exporting ? "Exporting…" : "Export .xlsx"}
            </button>
          </div>
        </div>
      </header>

      {/* ── Export error toast ── */}
      {exportErr && (
        <div style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid var(--error-500)",
          borderRadius: "var(--rounded-lg)",
          marginBottom: "var(--space-4)",
          padding: "var(--space-3) var(--space-4)",
          display: "flex", gap: "var(--space-2)", alignItems: "center",
          color: "var(--error-600)", fontSize: "0.875rem",
        }}>
          <AlertCircle size={16} />
          <strong>Export failed:</strong> {exportErr}
          <button
            onClick={() => setExportErr(null)}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Main Card ── */}
      <div className="card">

        {/* ── Filter bar — mirrors Manager layout exactly ── */}
        <div className="card__header" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "flex-start" }}>
          <h3 className="card__title" style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Calendar size={18} /> All Employee Timesheets
          </h3>

          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>

            {/* Search with autocomplete */}
            <div ref={searchRef} style={{ position: "relative" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search
                  size={15}
                  style={{ position: "absolute", left: 10, color: "var(--neutral-400)", pointerEvents: "none" }}
                />
                <input
                  id="hr-ts-search"
                  type="text"
                  className="input"
                  placeholder="Search by name or email…"
                  value={searchInput}
                  style={{ width: 230, height: 36, paddingLeft: 32, paddingRight: hasActiveSearch ? 32 : 12, fontSize: "0.875rem" }}
                  onChange={e => {
                    setSearchInput(e.target.value);
                    if (selectedEmployee !== "all") setSelectedEmployee("all");
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(suggestions.length > 0)}
                  autoComplete="off"
                />
                {hasActiveSearch && (
                  <button
                    onClick={handleClearSearch}
                    title="Clear search"
                    style={{
                      position: "absolute", right: 8,
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--neutral-400)", display: "flex", alignItems: "center", padding: 0,
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {showDropdown && suggestions.length > 0 && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
                  background: "white", border: "1px solid var(--neutral-200)",
                  borderRadius: "var(--rounded-lg)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                  overflow: "hidden", maxHeight: 220, overflowY: "auto",
                }}>
                  {suggestions.map(u => (
                    <button
                      key={u.entra_oid}
                      onMouseDown={() => handleSelectSuggestion(u)}
                      style={{
                        display: "flex", flexDirection: "column", width: "100%", textAlign: "left",
                        padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
                        borderBottom: "1px solid var(--neutral-100)", transition: "background 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--neutral-50)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{u.name}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Employee dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase" }}>
                Employee:
              </span>
              <select
                id="hr-ts-employee-filter"
                className="input"
                style={{ width: 180, height: 36, fontSize: "0.875rem" }}
                value={selectedEmployee}
                onChange={e => {
                  setSelectedEmployee(e.target.value);
                  if (e.target.value === "all") {
                    setSearchInput("");
                  } else {
                    const found = employees.find(u => u.entra_oid === e.target.value);
                    if (found) setSearchInput(found.name);
                  }
                }}
              >
                <option value="all">All Employees</option>
                {employees.map(u => (
                  <option key={u.entra_oid} value={u.entra_oid}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* Status dropdown */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase" }}>
                Status:
              </span>
              <select
                id="hr-ts-status-filter"
                className="input"
                style={{ width: 140, height: 36, fontSize: "0.875rem" }}
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

          </div>
        </div>

        {/* ── Active filter indicator ── */}
        {hasActiveSearch && (
          <div style={{
            padding: "var(--space-2) var(--space-6)",
            background: "var(--primary-50, #eff6ff)",
            borderBottom: "1px solid var(--primary-100, #dbeafe)",
            display: "flex", alignItems: "center", gap: "var(--space-2)",
            fontSize: "0.8rem", color: "var(--primary-700, #1d4ed8)",
          }}>
            <Search size={13} />
            Filtering by:&nbsp;
            <strong>
              {selectedEmployee !== "all"
                ? employees.find(u => u.entra_oid === selectedEmployee)?.name || selectedEmployee
                : `"${searchInput}"`}
            </strong>
            &nbsp;—&nbsp;
            <button
              onClick={handleClearSearch}
              style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", textDecoration: "underline", padding: 0, fontSize: "inherit" }}
            >
              Clear
            </button>
          </div>
        )}

        {/* ── Table ── */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Week Starting</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Reviewed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-500)", padding: "var(--space-10)" }}>
                    Loading timesheets…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--error-600)", padding: "var(--space-6)" }}>
                    <AlertCircle size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />
                    {error}
                  </td>
                </tr>
              ) : displayedTimesheets.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-500)", padding: "var(--space-10)" }}>
                    {hasActiveSearch
                      ? `No timesheets found for "${searchInput || employees.find(u => u.entra_oid === selectedEmployee)?.name}"`
                      : "No timesheets found for current selection"}
                  </td>
                </tr>
              ) : (
                displayedTimesheets.map(ts => (
                  <tr key={ts.id}>

                    {/* Employee */}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <div className="avatar avatar--sm" style={{ width: 28, height: 28, fontSize: "0.75rem", flexShrink: 0 }}>
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

                    {/* Week Starting */}
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
                    <td style={{ fontSize: "0.8125rem", color: "var(--neutral-600)", whiteSpace: "nowrap" }}>
                      {fmt(ts.submitted_at)}
                    </td>

                    {/* Reviewed At */}
                    <td style={{ fontSize: "0.8125rem", color: "var(--neutral-600)", whiteSpace: "nowrap" }}>
                      {fmt(ts.reviewed_at)}
                    </td>

                    {/* Actions */}
                    <td>
                      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ padding: "0 var(--space-2)", height: 32 }}
                          onClick={() => { setSelectedTs(ts); setIsModalOpen(true); }}
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {ts.status === "reviewed" && (
                          <span style={{
                            fontSize: "0.75rem", color: "var(--success-700)",
                            fontWeight: 500, display: "flex", alignItems: "center", gap: "4px",
                          }}>
                            <CheckCircle size={13} /> Reviewed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div className="card__footer">
          <p style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
            HR has read-only access to <strong>submitted</strong>, <strong>reviewed</strong>, and <strong>rejected</strong> timesheets.
            Draft records remain private to employees. Use <strong>Export .xlsx</strong> to download data for the selected month.
          </p>
        </div>
      </div>

      {/* ── Timesheet Detail Modal — matches Manager modal exactly ── */}
      {isModalOpen && selectedTs && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            backgroundColor: "white", borderRadius: "12px",
            width: "90%", maxWidth: "800px", maxHeight: "85vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "var(--space-4) var(--space-6)",
              borderBottom: "1px solid var(--neutral-200)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0 }}>
                Timesheet — {selectedTs.employee_name || "Unknown"}
              </h2>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => { setIsModalOpen(false); setSelectedTs(null); }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "var(--space-6)", overflowY: "auto" }}>
              {/* Summary row */}
              <div style={{ display: "flex", gap: "var(--space-8)", marginBottom: "var(--space-6)" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: 600 }}>
                    Employee
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "1rem" }}>
                    {selectedTs.employee_name}
                  </div>
                  {selectedTs.employee_email && (
                    <div style={{ fontSize: "0.8125rem", color: "var(--neutral-500)" }}>
                      {selectedTs.employee_email}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: 600 }}>
                    Week Starting
                  </div>
                  <div style={{ fontWeight: 600, fontSize: "1.125rem" }}>
                    {fmt(selectedTs.week_start_date)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: 600 }}>
                    Total Hours
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "1.5rem", color: "var(--primary-600)" }}>
                    {selectedTs.total_hours}h
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: 600 }}>
                    Status
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <StatusBadge status={selectedTs.status} />
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div style={{
                display: "flex", gap: "var(--space-6)", marginBottom: "var(--space-6)",
                padding: "var(--space-4)", background: "var(--neutral-50)",
                borderRadius: "var(--rounded-lg)", border: "1px solid var(--neutral-200)",
              }}>
                <div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--neutral-400)", fontWeight: 600, textTransform: "uppercase" }}>
                    Submitted At
                  </div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--neutral-700)" }}>
                    {fmt(selectedTs.submitted_at)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "0.6875rem", color: "var(--neutral-400)", fontWeight: 600, textTransform: "uppercase" }}>
                    Reviewed At
                  </div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--neutral-700)" }}>
                    {fmt(selectedTs.reviewed_at)}
                  </div>
                </div>
              </div>

              <p style={{ fontSize: "0.8125rem", color: "var(--neutral-400)", fontStyle: "italic" }}>
                Entry-level detail is managed by the employee's direct manager. HR has read-only access to timesheet summary records.
              </p>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "var(--space-4) var(--space-6)",
              borderTop: "1px solid var(--neutral-200)",
              display: "flex", justifyContent: "flex-end",
              backgroundColor: "var(--neutral-50)",
            }}>
              <button
                className="btn btn--secondary"
                onClick={() => { setIsModalOpen(false); setSelectedTs(null); }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
