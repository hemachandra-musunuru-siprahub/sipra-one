import React, { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { 
  Plus, Trash2, Send, ChevronLeft, ChevronRight, 
  History, Calendar as CalendarIcon, Clock, AlertCircle, 
  CheckCircle, FileText, X, Save, Pencil, Filter
} from "lucide-react";
import { 
  getMyTimesheet, addEntry, deleteEntry, submitTimesheet, 
  putUpdateEntry, getMyTimesheetHistory 
} from "../../api/timesheets";
import type { Timesheet, TimesheetEntry, TimesheetHistoryItem } from "../../api/types";
import { formatDate } from "../../utils/dateFormatter";
import { normalizeRole } from "../../lib/roleHelper";
import type { UserRole } from "../../lib/roleHelper";

interface Props { internalUser: any; role?: string; }

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const normalizeDate = (d: string | Date) => {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfBusinessWeek = (d: string | Date) => {
  const date = new Date(d);
  // If it's a string like "YYYY-MM-DD", force it to local midnight
  // to avoid UTC shifting during getDay()
  if (typeof d === "string" && d.length === 10) {
    const [y, m, day] = d.split("-").map(Number);
    date.setFullYear(y, m - 1, day);
    date.setHours(0, 0, 0, 0);
  }
  
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day; // 1 is Monday
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return normalizeDate(monday);
};

export const EmployeeTimesheetPage = ({ internalUser, role }: Props) => {
  const displayRole: UserRole = normalizeRole(role || internalUser?.roleFromEntra || "Employee");
  const [activeTab, setActiveTab] = useState<"current" | "history">("current");
  
  // -- Current Week State --
  const [currentWeek, setCurrentWeek] = useState(() => startOfBusinessWeek(new Date()));
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loadingWeek, setLoadingWeek] = useState(true);
  
  // -- History State --
  const [history, setHistory] = useState<TimesheetHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("");

  // -- Entry Form State --
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ 
    workDate: "", 
    projectName: "", 
    taskDescription: "", 
    hours: 8 
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Edit State --
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // -- Load Current Week --
  const loadWeek = async (week: string) => {
    setLoadingWeek(true);
    try {
      // Ensure we query the API using the normalized Monday
      const monday = startOfBusinessWeek(week);
      const d = await getMyTimesheet(monday);
      setTimesheet(d.timesheet);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingWeek(false);
    }
  };

  // -- Load History --
  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const d = await getMyTimesheetHistory({ 
        status: statusFilter, 
        month: monthFilter || undefined 
      });
      setHistory(d.timesheets);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === "current") {
      loadWeek(currentWeek);
    } else {
      loadHistory();
    }
  }, [currentWeek, activeTab, statusFilter, monthFilter]);

  const navigateWeek = (dir: number) => {
    // Start from the current Monday and jump 7 days
    const monday = new Date(currentWeek + "T00:00:00");
    monday.setDate(monday.getDate() + dir * 7);
    setCurrentWeek(normalizeDate(monday));
  };

  const handleAddEntry = async () => {
    if (!timesheet || !form.workDate || !form.projectName || !form.taskDescription) {
      setError("Please fill all required fields.");
      return;
    }
    if (form.hours <= 0 || form.hours > 24) {
      setError("Hours must be between 0.5 and 24.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const { timesheet: updated } = await addEntry(timesheet.id, {
        workDate: form.workDate,
        projectName: form.projectName,
        taskDescription: form.taskDescription,
        hours: form.hours
      });
      setTimesheet(updated);
      setShowAddModal(false);
      setForm({ workDate: "", projectName: "", taskDescription: "", hours: 8 });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateEntry = async (entryId: string, data: any) => {
    if (!timesheet) return;
    setIsUpdating(true);
    try {
      const { timesheet: updated } = await putUpdateEntry(entryId, data);
      setTimesheet(updated);
      setEditingEntry(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!timesheet) return;
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      const { timesheet: updated } = await deleteEntry(timesheet.id, entryId);
      setTimesheet(updated);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSubmitWeek = async () => {
    if (!timesheet) return;
    if (timesheet.total_hours === 0) {
      alert("Cannot submit an empty timesheet.");
      return;
    }

    // Tailor the confirm message for HR/Manager who may be auto-approved
    const isHrOrManager = displayRole === "HR" || displayRole === "Manager";
    const confirmMsg = isHrOrManager && !internalUser?.manager_entra_oid
      ? "Submit and auto-approve this timesheet? It will be marked as Reviewed immediately."
      : "Submit this timesheet for review? It will become read-only.";

    if (!window.confirm(confirmMsg)) return;
    
    setSubmitting(true);
    try {
      const result = await submitTimesheet(timesheet.id);
      setTimesheet(result.timesheet);

      if (result.autoApproved) {
        alert("✅ Timesheet auto-approved! Your timesheet has been marked as Reviewed.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const isEditable = timesheet?.status === "draft" || timesheet?.status === "rejected";

  // Group entries by day
  const groupedEntries = useMemo(() => {
    const groups: Record<string, TimesheetEntry[]> = {};
    if (!timesheet) return groups;
    
    // Determine the true start date in local terms
    const start = new Date(timesheet.week_start_date);
    
    // Create entries for Mon-Fri
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      // Move by i days locally
      d.setDate(start.getDate() + i);
      const key = normalizeDate(d);
      
      groups[key] = (timesheet.entries || []).filter(e => normalizeDate(e.work_date) === key);
    }
    return groups;
  }, [timesheet]);

  // Derived totals for accuracy
  const calculatedTotal = useMemo(() => {
    return Object.values(groupedEntries)
      .flat()
      .reduce((sum, e) => sum + Number(e?.hours || 0), 0);
  }, [groupedEntries]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "reviewed": return { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", icon: <CheckCircle size={12} /> };
      case "submitted": return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", icon: <Clock size={12} /> };
      case "rejected": return { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA", icon: <AlertCircle size={12} /> };
      default: return { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB", icon: <FileText size={12} /> };
    }
  };

  return (
    <DashboardLayout internalUser={internalUser} role={displayRole}>
      {/* -- Header -- */}
      <header className="page-header" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Work Logs</h1>
          
          <div style={{ 
            display: "flex", 
            background: "var(--neutral-100)", 
            padding: "4px", 
            borderRadius: "8px",
            gap: "4px"
          }}>
            <button 
              onClick={() => setActiveTab("current")}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: activeTab === "current" ? "white" : "transparent",
                color: activeTab === "current" ? "var(--neutral-900)" : "var(--neutral-500)",
                boxShadow: activeTab === "current" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.2s"
              }}
            >
              <CalendarIcon size={14} /> Current Week
            </button>
            <button 
              onClick={() => setActiveTab("history")}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: activeTab === "history" ? "white" : "transparent",
                color: activeTab === "history" ? "var(--neutral-900)" : "var(--neutral-500)",
                boxShadow: activeTab === "history" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.2s"
              }}
            >
              <History size={14} /> All Timesheets
            </button>
          </div>
        </div>
      </header>

      {activeTab === "current" ? (
        <>
          {/* -- Week Selector & Summary -- */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "20px",
            background: "white",
            padding: "16px 24px",
            borderRadius: "12px",
            border: "1px solid var(--neutral-200)",
            boxShadow: "var(--shadow-sm)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button 
                  className="btn btn--ghost btn--sm" 
                  onClick={() => navigateWeek(-1)}
                  style={{ width: 32, height: 32, padding: 0 }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  className="btn btn--secondary btn--sm" 
                  onClick={() => setCurrentWeek(startOfBusinessWeek(new Date()))}
                  style={{ fontSize: "12px", padding: "4px 12px", height: 32 }}
                >
                  Today
                </button>
                <button 
                  className="btn btn--ghost btn--sm" 
                  onClick={() => navigateWeek(1)}
                  style={{ width: 32, height: 32, padding: 0 }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
              <div style={{ textAlign: "center", minWidth: "140px" }}>
                <div style={{ fontSize: "11px", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase" }}>Week Starting</div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>{formatDate(currentWeek)}</div>
              </div>
              
              <div style={{ height: "32px", width: "1px", background: "var(--neutral-200)" }} />
              
              <div style={{ display: "flex", gap: "24px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: "2px" }}>Total Hours</div>
                  <div style={{ fontWeight: 800, fontSize: "20px", color: "var(--primary-600)", letterSpacing: "-0.02em" }}>
                    {loadingWeek ? "..." : `${calculatedTotal.toFixed(2)}h`}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: "2px" }}>Status</div>
                  {loadingWeek ? (
                    <div style={{ height: "20px", width: "60px", background: "var(--neutral-100)", borderRadius: "4px" }} />
                  ) : (
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "6px",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      border: `1px solid ${getStatusColor(timesheet?.status || "draft").border}`,
                      ...getStatusColor(timesheet?.status || "draft")
                    }}>
                      {getStatusColor(timesheet?.status || "draft").icon}
                      {timesheet?.status}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              {isEditable && (
                <>
                  <button 
                    className="btn btn--secondary" 
                    onClick={() => {
                      setForm({ ...form, workDate: currentWeek });
                      setShowAddModal(true);
                    }}
                  >
                    <Plus size={16} /> Add Entry
                  </button>
                  <button 
                    className="btn btn--primary" 
                    onClick={handleSubmitWeek}
                    disabled={submitting || !timesheet?.entries.length}
                  >
                    <Send size={16} /> {submitting ? "Submitting..." : "Submit for Review"}
                  </button>
                </>
              )}
            </div>
          </div>

          {timesheet?.manager_comment && (
            <div style={{ 
              marginBottom: "20px", 
              padding: "12px 16px", 
              background: "#FFFBEB", 
              border: "1px solid #FEF3C7", 
              borderRadius: "8px",
              display: "flex",
              gap: "12px",
              color: "#92400E"
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px" }}>Manager Feedback</div>
                <div style={{ fontSize: "13px" }}>{timesheet.manager_comment}</div>
              </div>
            </div>
          )}

          {/* -- Weekly Calendar Grid -- */}
          <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(5, 1fr)", 
            gap: "12px",
            minHeight: "320px"
          }}>
            {WEEKDAYS.map((dayName, idx) => {
              const start = new Date(currentWeek);
              const date = new Date(start);
              date.setDate(start.getDate() + idx);
              const dateStr = normalizeDate(date);
              const entries = groupedEntries[dateStr] || [];
              const dayTotal = entries.reduce((sum, e) => sum + Number(e.hours), 0);
              const isToday = normalizeDate(new Date()) === dateStr;

              return (
                <div key={dayName} style={{
                  background: "white",
                  borderRadius: "12px",
                  border: "1px solid var(--neutral-200)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  boxShadow: "var(--shadow-sm)",
                  transition: "transform 0.2s, box-shadow 0.2s"
                }}>
                  <div style={{ 
                    padding: "10px 12px", 
                    background: isToday ? "var(--primary-50, #fef2f2)" : "var(--neutral-50)",
                    borderBottom: "1px solid var(--neutral-200)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: 700, color: isToday ? "var(--primary-700)" : "var(--neutral-500)", textTransform: "uppercase" }}>{dayName}</div>
                      <div style={{ fontSize: "13px", fontWeight: 600 }}>{date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                    </div>
                    <div style={{ 
                      fontSize: "14px", 
                      fontWeight: 800, 
                      color: dayTotal > 8 ? "var(--error-600)" : "var(--neutral-900)"
                    }}>
                      {dayTotal}h
                    </div>
                  </div>

                    <div style={{ padding: "8px", flex: 1, display: "flex", flexDirection: "column", gap: "8px", background: "#fafafa" }}>
                      {entries.map(entry => (
                        <div key={entry.id} style={{
                          background: "white",
                          padding: "10px",
                          borderRadius: "8px",
                          border: "1px solid var(--neutral-200)",
                          fontSize: "12px",
                          position: "relative",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                        }}>
                          <div style={{ fontWeight: 700, color: "var(--neutral-900)", marginBottom: "2px" }}>{entry.project_name}</div>
                          <div style={{ color: "var(--neutral-500)", marginBottom: "8px", lineHeight: "1.4" }}>{entry.task_description}</div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontWeight: 700, color: "var(--primary-700)" }}>{entry.hours}h</div>
                            {isEditable && (
                              <div style={{ display: "flex", gap: "2px" }}>
                                <button 
                                  className="btn btn--ghost btn--sm" 
                                  style={{ padding: 4, height: 24, width: 24, color: "var(--neutral-400)", minWidth: "auto" }}
                                  onClick={() => setEditingEntry(entry)}
                                  onMouseEnter={e => (e.currentTarget.style.color = "var(--primary-600)")}
                                  onMouseLeave={e => (e.currentTarget.style.color = "var(--neutral-400)")}
                                >
                                  <Pencil size={14} />
                                </button>
                                <button 
                                  className="btn btn--ghost btn--sm" 
                                  style={{ padding: 4, height: 24, width: 24, color: "var(--neutral-400)", minWidth: "auto" }}
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  onMouseEnter={e => (e.currentTarget.style.color = "var(--error-600)")}
                                  onMouseLeave={e => (e.currentTarget.style.color = "var(--neutral-400)")}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {isEditable && (
                        <button 
                          onClick={() => {
                            setForm({ ...form, workDate: dateStr });
                            setShowAddModal(true);
                          }}
                          style={{
                            background: "none",
                            border: "1px dashed var(--neutral-300)",
                            borderRadius: "8px",
                            padding: "6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "var(--neutral-500)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = "var(--primary-300)";
                            e.currentTarget.style.color = "var(--primary-600)";
                            e.currentTarget.style.background = "var(--primary-50)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = "var(--neutral-300)";
                            e.currentTarget.style.color = "var(--neutral-500)";
                            e.currentTarget.style.background = "none";
                          }}
                        >
                          <Plus size={14} /> Add Task
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontSize: "11px", color: "var(--neutral-400)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={12} /> Changes are automatically saved as draft
              </span>
            </div>
          </>
      ) : (
        /* -- History View -- */
        <div className="card" style={{ border: "1px solid var(--neutral-200)", borderRadius: "12px", overflow: "hidden" }}>
          <div className="card__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px" }}>
            <h3 className="card__title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <History size={18} /> Timesheet History
            </h3>
            
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Filter size={14} style={{ position: "absolute", left: "10px", color: "var(--neutral-400)" }} />
                <select 
                  className="input" 
                  value={statusFilter} 
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ height: "36px", paddingLeft: "32px", fontSize: "13px", minWidth: "140px" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="submitted">Submitted</option>
                  <option value="reviewed">Reviewed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              
              <input 
                type="month" 
                className="input" 
                value={monthFilter}
                onChange={e => setMonthFilter(e.target.value)}
                style={{ height: "36px", fontSize: "13px" }}
              />
            </div>
          </div>
          
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Week Range</th>
                  <th>Hours</th>
                  <th>Entries</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Reviewed</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingHistory ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--neutral-400)" }}>Loading history...</td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "var(--neutral-400)" }}>No timesheet records found.</td></tr>
                ) : history.map(item => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>
                      {formatDate(item.week_start_date)}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: "var(--primary-600)" }}>{item.total_hours}h</span>
                    </td>
                    <td style={{ color: "var(--neutral-500)" }}>{item.entries_count} tasks</td>
                    <td>
                      <div style={{ 
                        display: "inline-flex", 
                        alignItems: "center", 
                        gap: "6px",
                        padding: "2px 10px",
                        borderRadius: "20px",
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        ...getStatusColor(item.status)
                      }}>
                        {getStatusColor(item.status).icon}
                        {item.status}
                      </div>
                    </td>
                    <td style={{ fontSize: "13px", color: "var(--neutral-500)" }}>{item.submitted_at ? formatDate(item.submitted_at) : "—"}</td>
                    <td style={{ fontSize: "13px", color: "var(--neutral-500)" }}>{item.reviewed_at ? formatDate(item.reviewed_at) : "—"}</td>
                    <td style={{ textAlign: "right" }}>
                      <button 
                        className="btn btn--secondary btn--sm"
                        onClick={() => {
                          setCurrentWeek(normalizeDate(item.week_start_date));
                          setActiveTab("current");
                        }}
                      >
                        {item.status === "draft" || item.status === "rejected" ? "Edit" : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -- Add Entry Modal -- */}
      {showAddModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "white", borderRadius: "12px",
            width: "100%", maxWidth: "450px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--neutral-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Add Time Entry</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neutral-400)" }}><X size={20} /></button>
            </div>
            
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Date</label>
                <input 
                  className="input" 
                  type="date" 
                  value={form.workDate} 
                  onChange={e => setForm({ ...form, workDate: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Project Name</label>
                <input 
                  className="input" 
                  placeholder="e.g. SipraHub Intranet" 
                  value={form.projectName} 
                  onChange={e => setForm({ ...form, projectName: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Task Description</label>
                <textarea 
                  className="input" 
                  placeholder="What did you work on?" 
                  style={{ height: "80px", resize: "none", padding: "10px" }}
                  value={form.taskDescription} 
                  onChange={e => setForm({ ...form, taskDescription: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Hours</label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <input 
                    className="input" 
                    type="number" 
                    min={0.5} 
                    max={24} 
                    step={0.5} 
                    value={form.hours} 
                    onChange={e => setForm({ ...form, hours: parseFloat(e.target.value) })} 
                    style={{ width: "100px" }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--neutral-400)" }}>Max 24h per day</span>
                </div>
              </div>
              
              {error && (
                <div style={{ display: "flex", gap: "8px", color: "var(--error-600)", fontSize: "13px", alignItems: "center" }}>
                  <AlertCircle size={16} /> {error}
                </div>
              )}
            </div>
            
            <div style={{ padding: "16px 24px", background: "var(--neutral-50)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button className="btn btn--secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleAddEntry} disabled={submitting}>
                {submitting ? "Adding..." : "Add Entry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Edit Entry Modal -- */}
      {editingEntry && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            background: "white", borderRadius: "12px",
            width: "100%", maxWidth: "450px",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
            overflow: "hidden"
          }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--neutral-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Edit Entry</h3>
              <button onClick={() => setEditingEntry(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neutral-400)" }}><X size={20} /></button>
            </div>
            
            <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Date</label>
                <input 
                  className="input" 
                  type="date" 
                  value={editingEntry.work_date} 
                  onChange={e => setEditingEntry({ ...editingEntry, work_date: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Project Name</label>
                <input 
                  className="input" 
                  value={editingEntry.project_name} 
                  onChange={e => setEditingEntry({ ...editingEntry, project_name: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Task Description</label>
                <textarea 
                  className="input" 
                  style={{ height: "80px", resize: "none", padding: "10px" }}
                  value={editingEntry.task_description} 
                  onChange={e => setEditingEntry({ ...editingEntry, task_description: e.target.value })} 
                />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Hours</label>
                <input 
                  className="input" 
                  type="number" 
                  min={0.5} 
                  max={24} 
                  step={0.5} 
                  value={editingEntry.hours} 
                  onChange={e => setEditingEntry({ ...editingEntry, hours: parseFloat(e.target.value) })} 
                  style={{ width: "100px" }}
                />
              </div>
            </div>
            
            <div style={{ padding: "16px 24px", background: "var(--neutral-50)", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button className="btn btn--secondary" onClick={() => setEditingEntry(null)}>Cancel</button>
              <button 
                className="btn btn--primary" 
                onClick={() => handleUpdateEntry(editingEntry.id, {
                  date: editingEntry.work_date,
                  project: editingEntry.project_name,
                  task: editingEntry.task_description,
                  hours: editingEntry.hours
                })} 
                disabled={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
