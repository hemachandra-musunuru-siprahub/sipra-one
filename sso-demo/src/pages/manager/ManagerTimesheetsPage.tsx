import React, { useState, useEffect, useMemo, useRef } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Calendar, CheckCircle, Download, Eye, X, Search } from "lucide-react";
import { getTeamTimesheets, reviewTimesheet, exportManagerTimesheets, getTimesheetDetail } from "../../api/timesheets";
import { getTeamMembers } from "../../api/users";
import type { Timesheet, User } from "../../api/types";

interface Props { internalUser: any; }

export const ManagerTimesheetsPage = ({ internalUser }: Props) => {
  const [timesheets, setTimesheets]     = useState<Timesheet[]>([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [teamMembers, setTeamMembers]   = useState<User[]>([]);

  // ── Search state ─────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput]   = useState("");          // raw typed value
  const [searchTerm, setSearchTerm]     = useState("");          // debounced, sent to API
  const [showDropdown, setShowDropdown] = useState(false);       // autocomplete panel
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Modal state ───────────────────────────────────────────────────────────────
  const [selectedTs, setSelectedTs]   = useState<Timesheet | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Month filter — default to current month ───────────────────────────────────
  const [selectedMonth, setSelectedMonth] = useState(
    () => new Date().toISOString().slice(0, 7)  // YYYY-MM
  );

  // ─── Utilities ──────────────────────────────────────────────────────────────
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // ─── Fetch team members once ─────────────────────────────────────────────────
  useEffect(() => {
    getTeamMembers().then(setTeamMembers).catch(console.error);
  }, []);

  // ─── Close autocomplete when clicking outside ────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ─── Debounce: update searchTerm 400ms after user stops typing ───────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Only trigger backend search if no specific employee is locked in
      if (employeeFilter === "all") {
        setSearchTerm(searchInput);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput, employeeFilter]);

  // ─── Filtered autocomplete suggestions ───────────────────────────────────────
  const suggestions = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return [];
    return teamMembers.filter(
      m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    );
  }, [searchInput, teamMembers]);

  // ─── Fetch timesheets when filters change ────────────────────────────────────
  useEffect(() => {
    console.log("timesheet filters", { employeeFilter, statusFilter, searchTerm });
    setLoading(true);
    // If a specific employee is selected via dropdown/suggestion, use employeeId filter.
    // If using free-text search only, pass search param and use all employees.
    getTeamTimesheets(
      employeeFilter !== "all" ? employeeFilter : undefined,
      statusFilter   !== "all" ? statusFilter   : undefined,
      employeeFilter === "all" ? searchTerm      : undefined
    )
      .then(data => setTimesheets(data.timesheets))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [employeeFilter, statusFilter, searchTerm]);

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleSelectSuggestion = (member: User) => {
    setSearchInput(member.name);
    setSearchTerm("");            // backend uses employeeFilter, not search when OID is set
    setEmployeeFilter(member.entra_oid);
    setShowDropdown(false);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchTerm("");
    setEmployeeFilter("all");
    setShowDropdown(false);
  };

  const handleViewTs = async (id: string) => {
    try {
      const { timesheet } = await getTimesheetDetail(id);
      setSelectedTs(timesheet);
      setReviewComment(timesheet.manager_comment || "");
      setIsModalOpen(true);
    } catch (e) { console.error(e); }
  };

  const handleReviewTs = async (id: string, status: "reviewed" | "draft") => {
    setIsReviewing(true);
    try {
      const { timesheet } = await reviewTimesheet(id, status, reviewComment);
      setTimesheets(prev => prev.map(t => t.id === id ? timesheet : t));
      setIsModalOpen(false);
      setSelectedTs(null);
    } catch (e) {
      console.error(e);
      alert("Failed to review timesheet. Status might have changed.");
    } finally {
      setIsReviewing(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportManagerTimesheets(employeeFilter, selectedMonth);
    } catch (e: any) {
      console.error("Export failed:", e);
      alert(`Export failed: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const submittedCount = timesheets.filter(t => t.status === "submitted").length;
  const hasActiveSearch = searchInput.trim() !== "" || employeeFilter !== "all";

  return (
    <DashboardLayout internalUser={internalUser} role="Manager">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Manager</span><span className="breadcrumb__separator">/</span><span>Team Timesheets</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Team Timesheets</h1>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--neutral-600)" }}>
              {submittedCount} awaiting review
            </span>

            {/* Month picker */}
            <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.875rem" }}>
              <Calendar size={16} style={{ color: "var(--neutral-500)" }} />
              <input
                type="month"
                className="input"
                style={{ height: 36, fontSize: "0.875rem", width: 150 }}
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              />
            </label>

            <button
              className="btn btn--secondary"
              onClick={handleExport}
              disabled={isExporting}
              title="Export reviewed timesheets for current filters as Excel"
            >
              <Download size={16} />
              {isExporting ? "Exporting…" : "Export .xlsx"}
            </button>
          </div>
        </div>
      </header>

      <div className="card">
        {/* ── Filter bar ─────────────────────────────────────────────────────── */}
        <div className="card__header" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", alignItems: "flex-start" }}>
          <h3 className="card__title" style={{ marginRight: "auto", display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Calendar size={18} /> Team Timesheet Records
          </h3>

          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>

            {/* ── Employee search + autocomplete ──────────────────────────── */}
            <div ref={searchRef} style={{ position: "relative" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search
                  size={15}
                  style={{
                    position: "absolute", left: 10,
                    color: "var(--neutral-400)", pointerEvents: "none",
                  }}
                />
                <input
                  id="employee-search"
                  type="text"
                  className="input"
                  placeholder="Search by name or email…"
                  value={searchInput}
                  style={{ width: 230, height: 36, paddingLeft: 32, paddingRight: hasActiveSearch ? 32 : 12, fontSize: "0.875rem" }}
                  onChange={e => {
                    setSearchInput(e.target.value);
                    // If the user starts typing again after selecting a specific employee,
                    // reset back to "all" so the search becomes the filter again
                    if (employeeFilter !== "all") setEmployeeFilter("all");
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
                      color: "var(--neutral-400)", display: "flex", alignItems: "center",
                      padding: 0,
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
                  {suggestions.map(m => (
                    <button
                      key={m.entra_oid}
                      onMouseDown={() => handleSelectSuggestion(m)}   // mousedown fires before blur
                      style={{
                        display: "flex", flexDirection: "column", width: "100%", textAlign: "left",
                        padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
                        borderBottom: "1px solid var(--neutral-100)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--neutral-50)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    >
                      <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{m.name}</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{m.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Employee dropdown (still usable for precise selection) ──── */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase" }}>Employee:</span>
              <select
                className="input"
                style={{ width: 180, height: 36, fontSize: "0.875rem" }}
                value={employeeFilter}
                onChange={e => {
                  setEmployeeFilter(e.target.value);
                  // Reflect selected name in the search box
                  if (e.target.value === "all") {
                    setSearchInput("");
                    setSearchTerm("");
                  } else {
                    const found = teamMembers.find(m => m.entra_oid === e.target.value);
                    if (found) setSearchInput(found.name);
                  }
                }}
              >
                <option value="all">All Employees</option>
                {teamMembers.map(m => (
                  <option key={m.entra_oid} value={m.entra_oid}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* ── Status filter ─────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase" }}>Status:</span>
              <select
                className="input"
                style={{ width: 140, height: 36, fontSize: "0.875rem" }}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Active search indicator ─────────────────────────────────────────── */}
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
              {employeeFilter !== "all"
                ? teamMembers.find(m => m.entra_oid === employeeFilter)?.name || employeeFilter
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

        {/* ── Table ──────────────────────────────────────────────────────────── */}
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Week Starting</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)", padding: "var(--space-10)" }}>Loading timesheets…</td></tr>
                : timesheets.length === 0
                  ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)", padding: "var(--space-10)" }}>
                      {hasActiveSearch
                        ? `No timesheets found for "${searchInput || teamMembers.find(m => m.entra_oid === employeeFilter)?.name}"`
                        : "No timesheets found for current selection"}
                    </td></tr>
                  : timesheets.map(ts => (
                    <tr key={ts.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <div className="avatar avatar--sm" style={{ width: 28, height: 28, fontSize: "0.75rem", flexShrink: 0 }}>
                            {(ts.employee_name || "E")[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: "0.875rem", fontWeight: 500 }}>{ts.employee_name || ts.employee_oid.slice(0, 8)}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: "0.875rem" }}>{formatDate(ts.week_start_date)}</td>
                      <td><strong>{ts.total_hours}h</strong></td>
                      <td>
                        <span className={`badge ${ts.status === "reviewed" ? "badge--published" : ts.status === "submitted" ? "badge--it" : "badge--draft"}`}>
                          {ts.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                          <button
                            className="btn btn--ghost btn--sm"
                            style={{ padding: "0 var(--space-2)", height: 32 }}
                            onClick={() => handleViewTs(ts.id)}
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          {ts.status === "submitted" && (
                            <button
                              className="btn btn--primary btn--sm"
                              style={{ height: 32, fontSize: "0.75rem" }}
                              onClick={() => handleViewTs(ts.id)}
                            >
                              Review
                            </button>
                          )}
                          {ts.status === "reviewed" && (
                            <span style={{ fontSize: "0.75rem", color: "var(--success-600)", fontWeight: 500, display: "flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle size={14} /> Reviewed
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Timesheet Detail Modal ──────────────────────────────────────────────── */}
      {isModalOpen && selectedTs && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
          backdropFilter: "blur(4px)",
        }}>
          <div style={{
            backgroundColor: "white", borderRadius: "12px",
            width: "90%", maxWidth: "900px", maxHeight: "90vh",
            display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)",
          }}>
            <div style={{
              padding: "var(--space-4) var(--space-6)",
              borderBottom: "1px solid var(--neutral-200)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700 }}>Timesheet — {selectedTs.employee_name}</h2>
              <button className="btn btn--ghost btn--sm" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <div style={{ padding: "var(--space-6)", overflowY: "auto" }}>
              <div style={{ display: "flex", gap: "var(--space-8)", marginBottom: "var(--space-6)" }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: 600 }}>Week Starting</div>
                  <div style={{ fontWeight: 600, fontSize: "1.125rem" }}>{formatDate(selectedTs.week_start_date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: 600 }}>Total Hours</div>
                  <div style={{ fontWeight: 700, fontSize: "1.5rem", color: "var(--primary-600)" }}>{selectedTs.total_hours}h</div>
                </div>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: 600 }}>Status</div>
                  <span className={`badge ${selectedTs.status === "reviewed" ? "badge--published" : selectedTs.status === "submitted" ? "badge--it" : "badge--draft"}`} style={{ marginTop: 4 }}>
                    {selectedTs.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="table-container" style={{ border: "1px solid var(--neutral-200)", borderRadius: "var(--rounded-lg)" }}>
                <table>
                  <thead>
                    <tr><th>Date</th><th>Project</th><th>Task / Description</th><th>Hours</th></tr>
                  </thead>
                  <tbody>
                    {selectedTs.entries && selectedTs.entries.length > 0
                      ? selectedTs.entries.map((entry: any) => (
                          <tr key={entry.id}>
                            <td>{formatDate(entry.work_date)}</td>
                            <td style={{ fontWeight: 500 }}>{entry.project_name}</td>
                            <td style={{ color: "var(--neutral-600)" }}>{entry.task_description}</td>
                            <td><strong>{entry.hours}h</strong></td>
                          </tr>
                        ))
                      : <tr><td colSpan={4} style={{ textAlign: "center", padding: "var(--space-6)", color: "var(--neutral-500)" }}>No time entries found.</td></tr>
                    }
                  </tbody>
                </table>
              </div>

              {selectedTs.status === "submitted" && (
                <div style={{ marginTop: "var(--space-6)" }}>
                  <label style={{ fontSize: "0.875rem", fontWeight: 600, display: "block", marginBottom: "var(--space-2)" }}>Review Comments (Optional)</label>
                  <textarea
                    className="input"
                    style={{ width: "100%", height: "100px", padding: "12px", resize: "none" }}
                    placeholder="Add feedback for the employee..."
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                  />
                </div>
              )}

              {selectedTs.status === "reviewed" && selectedTs.manager_comment && (
                <div style={{ marginTop: "var(--space-6)", padding: "var(--space-4)", background: "var(--neutral-50)", borderRadius: "var(--rounded-lg)", border: "1px solid var(--neutral-200)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>Manager Comments</div>
                  <div style={{ fontSize: "0.875rem" }}>{selectedTs.manager_comment}</div>
                </div>
              )}
            </div>

            <div style={{
              padding: "var(--space-4) var(--space-6)",
              borderTop: "1px solid var(--neutral-200)",
              display: "flex", justifyContent: "flex-end", gap: "var(--space-3)",
              backgroundColor: "var(--neutral-50)",
            }}>
              <button className="btn btn--secondary" onClick={() => setIsModalOpen(false)}>Close</button>
              {selectedTs.status === "submitted" && (
                <>
                  <button
                    className="btn btn--primary"
                    onClick={() => handleReviewTs(selectedTs.id, "reviewed")}
                    disabled={isReviewing}
                  >
                    <CheckCircle size={16} /> {isReviewing ? "Approving..." : "Approve Timesheet"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
