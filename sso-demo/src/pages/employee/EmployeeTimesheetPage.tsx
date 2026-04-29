import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Plus, Trash2, Send, ChevronLeft, ChevronRight } from "lucide-react";
import { getMyTimesheet, addEntry, deleteEntry, submitTimesheet } from "../../api/timesheets";
import type { Timesheet, TimesheetEntry } from "../../api/types";

interface Props { internalUser: any; }

const getMonday = (d: Date) => {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
};

export const EmployeeTimesheetPage = ({ internalUser }: Props) => {
  const [currentWeek, setCurrentWeek] = useState(getMonday(new Date()));
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ workDate: "", projectName: "", taskDescription: "", hours: 8 });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWeek = (week: string) => {
    setLoading(true);
    getMyTimesheet(week).then(d => setTimesheet(d.timesheet)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadWeek(currentWeek); }, [currentWeek]);

  const navigateWeek = (dir: number) => {
    const d = new Date(currentWeek);
    d.setDate(d.getDate() + dir * 7);
    setCurrentWeek(d.toISOString().slice(0, 10));
  };

  const handleAddEntry = async () => {
    if (!timesheet || !form.workDate || !form.projectName || !form.taskDescription) {
      setError("All fields are required."); return;
    }
    setError(null);
    try {
      const { timesheet: updated } = await addEntry(timesheet.id, {
        workDate: form.workDate, projectName: form.projectName,
        taskDescription: form.taskDescription, hours: form.hours,
      });
      setTimesheet(updated);
      setForm({ workDate: "", projectName: "", taskDescription: "", hours: 8 });
    } catch (e: any) { setError(e.message); }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!timesheet) return;
    try {
      const { timesheet: updated } = await deleteEntry(timesheet.id, entryId);
      setTimesheet(updated);
    } catch (e: any) { setError(e.message); }
  };

  const handleSubmit = async () => {
    if (!timesheet) return;
    setSubmitting(true);
    try {
      const { timesheet: updated } = await submitTimesheet(timesheet.id);
      setTimesheet(updated);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const isDraft = timesheet?.status === "draft";
  const statusBadge = (s: string) => ({ draft: "badge--draft", submitted: "badge--it", reviewed: "badge--published" }[s] || "badge--draft");

  return (
    <DashboardLayout internalUser={internalUser} role="Employee">
      <header className="page-header">
        <div className="breadcrumb"><span>Employee</span><span className="breadcrumb__separator">/</span><span>Timesheets</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">My Timesheet</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button className="btn btn--ghost btn--sm" onClick={() => navigateWeek(-1)}><ChevronLeft size={18} /></button>
            <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>Week of {currentWeek}</span>
            <button className="btn btn--ghost btn--sm" onClick={() => navigateWeek(1)}><ChevronRight size={18} /></button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="card"><div className="card__body" style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading timesheet…</div></div>
      ) : !timesheet ? null : (
        <>
          {/* Status bar */}
          <div className="card" style={{ marginBottom: "var(--space-4)" }}>
            <div className="card__body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: "var(--space-6)", alignItems: "center" }}>
                <span className={`badge ${statusBadge(timesheet.status)}`} style={{ fontSize: "0.875rem", padding: "6px 16px" }}>{timesheet.status.toUpperCase()}</span>
                <div><div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>Total Hours</div><div style={{ fontWeight: 700, fontSize: "1.5rem", color: "var(--primary-600)" }}>{timesheet.total_hours}h</div></div>
                <div><div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>Entries</div><div style={{ fontWeight: 600, fontSize: "1.125rem" }}>{timesheet.entries?.length || 0}</div></div>
                {timesheet.manager_comment && (
                  <div style={{ padding: "var(--space-3)", background: "var(--warning-50)", border: "1px solid var(--warning-200)", borderRadius: "var(--rounded-lg)", fontSize: "0.875rem" }}>
                    <strong>Manager note:</strong> {timesheet.manager_comment}
                  </div>
                )}
              </div>
              {isDraft && (
                <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting || !timesheet.entries?.length}>
                  <Send size={16} /> {submitting ? "Submitting…" : "Submit Week"}
                </button>
              )}
            </div>
          </div>

          {/* Entries table */}
          <div className="card" style={{ marginBottom: "var(--space-4)" }}>
            <div className="card__header"><h3 className="card__title">Time Entries</h3></div>
            <div className="table-container">
              <table>
                <thead><tr><th>Date</th><th>Project</th><th>Task</th><th>Hours</th>{isDraft && <th></th>}</tr></thead>
                <tbody>
                  {!timesheet.entries || timesheet.entries.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No entries yet. Add one below.</td></tr>
                  ) : timesheet.entries.map((entry: TimesheetEntry) => (
                    <tr key={entry.id}>
                      <td>{entry.work_date}</td>
                      <td style={{ fontWeight: 500 }}>{entry.project_name}</td>
                      <td style={{ color: "var(--neutral-600)", fontSize: "0.875rem" }}>{entry.task_description}</td>
                      <td><strong>{entry.hours}h</strong></td>
                      {isDraft && (
                        <td>
                          <button className="btn btn--ghost btn--sm" style={{ color: "var(--error-500)" }} onClick={() => handleDeleteEntry(entry.id)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Entry Form (draft only) */}
          {isDraft && (
            <div className="card">
              <div className="card__header"><h3 className="card__title"><Plus size={18} /> Add Entry</h3></div>
              <div className="card__body ts-entry-form">
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--neutral-600)", display: "block", marginBottom: "var(--space-1)" }}>Date *</label>
                  <input className="input" type="date" value={form.workDate} onChange={e => setForm(f => ({ ...f, workDate: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--neutral-600)", display: "block", marginBottom: "var(--space-1)" }}>Project *</label>
                  <input className="input" placeholder="Project name" value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--neutral-600)", display: "block", marginBottom: "var(--space-1)" }}>Task *</label>
                  <input className="input" placeholder="What did you work on?" value={form.taskDescription} onChange={e => setForm(f => ({ ...f, taskDescription: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", color: "var(--neutral-600)", display: "block", marginBottom: "var(--space-1)" }}>Hours *</label>
                  <input className="input" type="number" min={0.5} max={24} step={0.5} value={form.hours} onChange={e => setForm(f => ({ ...f, hours: parseFloat(e.target.value) }))} />
                </div>
                <button className="btn btn--primary" onClick={handleAddEntry}><Plus size={16} /> Add</button>
              </div>
              {error && <div style={{ padding: "0 var(--space-6) var(--space-4)", color: "var(--error-600)", fontSize: "0.875rem" }}>{error}</div>}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
};
