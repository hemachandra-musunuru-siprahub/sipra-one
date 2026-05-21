import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import {
  Plus, Trash2, Send, ChevronLeft, ChevronRight,
  History, Calendar as CalendarIcon, Clock, AlertCircle,
  CheckCircle, FileText, Pencil, Filter
} from "lucide-react";
import {
  getMyTimesheet, addEntry, deleteEntry, submitTimesheet,
  putUpdateEntry, getMyTimesheetHistory
} from "../../api/timesheets";
import type { Timesheet, TimesheetEntry, TimesheetHistoryItem } from "../../api/types";
import { formatDate } from "../../utils/dateFormatter";
import { normalizeRole } from "../../lib/roleHelper";
import type { UserRole } from "../../lib/roleHelper";
import { TimeEntryModal, type TimeEntryFormValues } from "../../components/TimeEntryModal";

interface Props { internalUser: any; role?: string; }

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const normalizeDate = (d: string | Date) => {
  // If it's a plain "YYYY-MM-DD" string, append T00:00:00 so JS parses it
  // as LOCAL midnight instead of UTC midnight (which shifts the date in UTC+ zones like IST).
  const date = typeof d === "string" && d.length === 10
    ? new Date(d + "T00:00:00")
    : new Date(d);
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
  const [addDate, setAddDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Edit State --
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);

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

  const handleAddEntry = async (values: TimeEntryFormValues) => {
    if (!timesheet) return;
    const { timesheet: updated } = await addEntry(timesheet.id, {
      workDate: values.workDate,
      projectName: values.projectName || "",
      taskDescription: values.taskDescription,
      hours: values.hours,
      entryType: values.entryType,
      jiraTaskId: values.jiraTaskId || null
    });
    setTimesheet(updated);
    setShowAddModal(false);
  };

  const handleUpdateEntry = async (entryId: string, values: TimeEntryFormValues) => {
    if (!timesheet) return;
    const { timesheet: updated } = await putUpdateEntry(entryId, {
      date: values.workDate,
      project: values.projectName || "",
      task: values.taskDescription,
      hours: values.hours,
      entryType: values.entryType,
      jiraTaskId: values.jiraTaskId || null
    });
    setTimesheet(updated);
    setEditingEntry(null);
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

    // Force local midnight to avoid UTC→local shift (e.g. IST = UTC+5:30).
    // "2026-05-18" via new Date() = UTC midnight = May 17 in IST.
    // Appending T00:00:00 forces the JS engine to use local time instead.
    const start = new Date(timesheet.week_start_date + "T00:00:00");

    // Create entries for Mon–Fri
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
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

  const calculatedExtra = useMemo(() => {
    return Object.values(groupedEntries).reduce((totalExtra, entries) => {
      const dayTotal = entries.reduce((sum, e) => sum + Number(e?.hours || 0), 0);
      if (dayTotal > 8) {
        return totalExtra + (dayTotal - 8);
      }
      return totalExtra;
    }, 0);
  }, [groupedEntries]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "reviewed": return { bg: "var(--success-50)", text: "var(--success-700)", border: "var(--success-500)", icon: <CheckCircle size={12} /> };
      case "submitted": return { bg: "var(--info-50)", text: "var(--info-700)", border: "var(--info-500)", icon: <Clock size={12} /> };
      case "rejected": return { bg: "var(--error-50)", text: "var(--error-700)", border: "var(--error-500)", icon: <AlertCircle size={12} /> };
      default: return { bg: "var(--neutral-50)", text: "var(--neutral-700)", border: "var(--neutral-200)", icon: <FileText size={12} /> };
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
            gap: "8px"
          }}>
            <button
              onClick={() => setActiveTab("current")}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                border: activeTab === "current" ? "1px solid transparent" : "1px solid var(--neutral-200)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: activeTab === "current" ? "var(--primary-500)" : "white",
                color: activeTab === "current" ? "white" : "var(--neutral-600)",
                boxShadow: activeTab === "current" ? "var(--shadow-sm)" : "none",
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
                border: activeTab === "history" ? "1px solid transparent" : "1px solid var(--neutral-200)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                background: activeTab === "history" ? "var(--primary-500)" : "white",
                color: activeTab === "history" ? "white" : "var(--neutral-600)",
                boxShadow: activeTab === "history" ? "var(--shadow-sm)" : "none",
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
                <div style={{ fontSize: "11px", color: "var(--neutral-600)", fontWeight: 600, textTransform: "uppercase" }}>Week Starting</div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>{formatDate(currentWeek)}</div>
              </div>

              <div style={{ height: "32px", width: "1px", background: "var(--neutral-200)" }} />

              <div style={{ display: "flex", gap: "24px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "var(--neutral-600)", fontWeight: 600, textTransform: "uppercase", marginBottom: "2px" }}>Total Hours</div>
                  <div style={{ fontWeight: 800, fontSize: "20px", color: "var(--primary-500)", letterSpacing: "-0.02em" }}>
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
                      background: getStatusColor(timesheet?.status || "draft").bg,
                      color: getStatusColor(timesheet?.status || "draft").text,
                    }}>
                      {getStatusColor(timesheet?.status || "draft").icon}
                      {timesheet?.status}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                height: "32px",
                boxSizing: "border-box"
              }}>
                <span style={{ fontSize: "10px", color: "var(--neutral-500)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>Status:</span>
                {loadingWeek ? (
                  <div style={{ height: "24px", width: "50px", background: "var(--neutral-100)", borderRadius: "4px" }} />
                ) : (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    border: `1px solid ${getStatusColor(timesheet?.status || "draft").border}`,
                    background: getStatusColor(timesheet?.status || "draft").bg,
                    color: getStatusColor(timesheet?.status || "draft").text,
                    height: "24px",
                    boxSizing: "border-box"
                  }}>
                    {getStatusColor(timesheet?.status || "draft").icon}
                    <span>{timesheet?.status}</span>
                  </div>
                )}
              </div>

              <div style={{ height: "20px", width: "1px", background: "var(--neutral-200)" }} />

              {isEditable && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={() => {
                      setAddDate(currentWeek);
                      setShowAddModal(true);
                    }}
                    style={{
                      background: "white",
                      border: "1px solid var(--neutral-300)",
                      borderRadius: "6px",
                      padding: "0 12px",
                      color: "var(--neutral-700)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      height: "32px",
                      transition: "all 0.2s",
                      boxSizing: "border-box"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = "var(--primary-500)";
                      e.currentTarget.style.color = "var(--primary-600)";
                      e.currentTarget.style.background = "var(--primary-50, #fef2f2)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = "var(--neutral-300)";
                      e.currentTarget.style.color = "var(--neutral-700)";
                      e.currentTarget.style.background = "white";
                    }}
                  >
                    <Plus size={14} style={{ color: "var(--neutral-500)" }} />
                    <span>Add Entry</span>
                  </button>
                  <button
                    onClick={handleSubmitWeek}
                    disabled={submitting || !timesheet?.entries.length}
                    style={{
                      background: "var(--primary-500)",
                      border: "1px solid transparent",
                      borderRadius: "6px",
                      padding: "0 14px",
                      color: "white",
                      cursor: submitting || !timesheet?.entries.length ? "not-allowed" : "pointer",
                      opacity: submitting || !timesheet?.entries.length ? 0.6 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      height: "32px",
                      boxShadow: "0 1px 2px rgba(206, 33, 36, 0.1)",
                      transition: "all 0.2s",
                      boxSizing: "border-box"
                    }}
                    onMouseEnter={e => {
                      if (!submitting && timesheet?.entries.length) {
                        e.currentTarget.style.background = "var(--primary-600)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!submitting && timesheet?.entries.length) {
                        e.currentTarget.style.background = "var(--primary-500)";
                      }
                    }}
                  >
                    <Send size={12} />
                    <span>{submitting ? "Submitting..." : "Submit for Review"}</span>
                  </button>
                </div>
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

          {error && (
            <div style={{
              marginBottom: "20px",
              padding: "12px 16px",
              background: "var(--error-50)",
              border: "1px solid var(--error-200)",
              borderRadius: "8px",
              display: "flex",
              gap: "12px",
              color: "var(--error-700)"
            }}>
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px" }}>Action Failed</div>
                <div style={{ fontSize: "13px" }}>{error}</div>
              </div>
            </div>
          )}

          {/* -- Weekly Calendar Grid -- */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "12px",
            alignItems: "start"
          }}>
            {WEEKDAYS.map((dayName, idx) => {
              // Force local midnight to avoid UTC shift (same as groupedEntries fix)
              const start = new Date(currentWeek + "T00:00:00");
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
                  transition: "transform 0.2s, box-shadow 0.2s",
                  height: "fit-content",
                  minHeight: "auto"
                }}>
                  <div style={{
                    padding: "10px 12px",
                    background: isToday ? "var(--primary-50, #fef2f2)" : "var(--neutral-50)",
                    borderBottom: "1px solid var(--neutral-200)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {isEditable && (
                        <button
                          onClick={() => {
                            setAddDate(dateStr);
                            setShowAddModal(true);
                          }}
                          style={{
                            background: "none",
                            border: "1px solid var(--neutral-300)",
                            borderRadius: "4px",
                            padding: "4px",
                            color: "var(--neutral-500)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "24px",
                            width: "24px",
                            minWidth: "auto",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = "var(--primary-500)";
                            e.currentTarget.style.color = "var(--primary-600)";
                            e.currentTarget.style.background = "var(--primary-50, #fef2f2)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = "var(--neutral-300)";
                            e.currentTarget.style.color = "var(--neutral-500)";
                            e.currentTarget.style.background = "none";
                          }}
                        >
                          <Plus size={16} />
                        </button>
                      )}
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: isToday ? "var(--primary-700)" : "var(--neutral-700)", textTransform: "uppercase" }}>{dayName}</div>
                        <div style={{ fontSize: "13px", fontWeight: 600 }}>{date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                      </div>
                    </div>
                    <div style={{
                      fontSize: "14px",
                      fontWeight: 800,
                      color: dayTotal > 8 ? "var(--error-700)" : "var(--neutral-800)"
                    }}>
                      {dayTotal}h
                    </div>
                  </div>

                  <div style={{
                    padding: "8px",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    background: "#fafafa"
                  }}>
                    {/* Stacked Kanban Cards */}
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      position: "relative",
                      zIndex: 2
                    }}>
                      {entries.map(entry => {
                        const typeLower = entry.entry_type?.toLowerCase() || "";
                        const projNameLower = entry.project_name?.toLowerCase() || "";
                        const isHoliday = typeLower === "holiday" || projNameLower === "holiday";
                        const isLeave = typeLower === "leave" || typeLower === "out_of_office" || entry.leave_request_id || projNameLower === "out of office";

                        // Define dynamic colors based on card category
                        let cardBg = "white";
                        let cardBorder = "1px solid var(--neutral-200)";
                        let titleColor = "var(--neutral-800)";
                        let descColor = "var(--neutral-500)";
                        let hoursColor = "var(--neutral-800)";

                        if (isLeave) {
                          cardBg = "var(--warning-50)";
                          cardBorder = "1px solid var(--warning-200, #FDE68A)";
                          titleColor = "var(--warning-700)";
                          descColor = "var(--warning-700)";
                          hoursColor = "var(--warning-700)";
                        } else if (isHoliday) {
                          cardBg = "var(--primary-50)";
                          cardBorder = "1px solid var(--primary-100)";
                          titleColor = "var(--primary-700)";
                          descColor = "var(--primary-700)";
                          hoursColor = "var(--primary-700)";
                        }

                        // Calculate proportional card height based on hours
                        const HOUR_HEIGHT = 24;
                        const MIN_CARD_HEIGHT = 75;
                        const cardHeight = Math.max(Number(entry.hours) * HOUR_HEIGHT, MIN_CARD_HEIGHT); return (
                          <div key={entry.id} style={{
                            background: cardBg,
                            padding: "10px",
                            borderRadius: "8px",
                            border: cardBorder,
                            fontSize: "12px",
                            position: "relative",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            height: `${cardHeight}px`,
                            boxSizing: "border-box",
                            display: "flex",
                            flexDirection: "column"
                          }}>
                            {/* Absolute positioned total hours badge */}
                            <div style={{
                              position: "absolute",
                              top: "10px",
                              right: "10px",
                              fontWeight: 800,
                              fontSize: "12px",
                              color: hoursColor,
                              zIndex: 3
                            }}>
                              {entry.hours}h
                            </div>

                            {/* Bottom Anchored Content Wrapper */}
                            <div style={{
                              marginTop: "auto",
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px",
                              width: "100%",
                              flexShrink: 0
                            }}>
                              {/* Header / Category / Project Name & Badges */}
                              <div style={{
                                fontWeight: 700,
                                color: titleColor,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                paddingRight: "32px", // Safe space to prevent overlap with absolute hours badge
                                flexShrink: 0
                              }}>
                                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginRight: "4px" }}>
                                  {entry.project_name || entry.entry_type || "Work"}
                                </span>
                                {(() => {
                                  if (isHoliday) {
                                    return (
                                      <span style={{
                                        fontSize: "10px",
                                        background: "var(--primary-100)",
                                        color: "var(--primary-700)",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        fontWeight: 600,
                                        whiteSpace: "nowrap"
                                      }}>
                                        Holiday
                                      </span>
                                    );
                                  }
                                  if (isLeave) {
                                    return (
                                      <span style={{
                                        fontSize: "10px",
                                        background: "var(--warning-100, #FEF3C7)",
                                        color: "var(--warning-700)",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        fontWeight: 600,
                                        whiteSpace: "nowrap"
                                      }}>
                                        Leave
                                      </span>
                                    );
                                  }
                                  if (entry.entry_type && typeLower !== "work") {
                                    return (
                                      <span style={{
                                        fontSize: "10px",
                                        background: "var(--neutral-100)",
                                        color: "var(--neutral-700)",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        fontWeight: 600,
                                        whiteSpace: "nowrap"
                                      }}>
                                        {entry.entry_type}
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>

                              {/* Jira ID */}
                              {entry.jira_task_id && (
                                <div style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: 600, flexShrink: 0 }}>
                                  {entry.jira_task_id}
                                </div>
                              )}

                              {/* Description */}
                              <div style={{
                                color: descColor,
                                fontSize: "11px",
                                lineHeight: "1.3",
                                display: "-webkit-box",
                                WebkitLineClamp: Math.max(1, Math.floor((cardHeight - 65) / 16)),
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                              }}>
                                {entry.task_description}
                              </div>

                              {/* Actions Footer */}
                              {isEditable && !entry.is_system_generated && (
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: "2px", marginTop: "2px", flexShrink: 0 }}>
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
                        );
                      })}
                    </div>


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

      {/* -- Modals -- */}
      <TimeEntryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddEntry}
        initialValues={{ workDate: addDate }}
        title="Add Time Entry"
        submitText="Add Entry"
      />

      {editingEntry && (
        <TimeEntryModal
          isOpen={true}
          onClose={() => setEditingEntry(null)}
          onSubmit={(values) => handleUpdateEntry(editingEntry.id, values)}
          initialValues={{
            workDate: editingEntry.work_date,
            projectName: editingEntry.project_name,
            taskDescription: editingEntry.task_description,
            hours: editingEntry.hours,
            entryType: (editingEntry.entry_type === "Meeting" || editingEntry.entry_type === "Leave" || editingEntry.entry_type === "Work")
              ? editingEntry.entry_type
              : "Work",
            jiraTaskId: editingEntry.jira_task_id || ""
          }}
          title="Edit Time Entry"
          submitText="Save Changes"
        />
      )}
    </DashboardLayout>
  );
};
