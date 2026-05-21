import React, { useState, useEffect } from "react";
import { X, AlertCircle } from "lucide-react";

export interface TimeEntryFormValues {
  workDate: string;
  projectName?: string;
  taskDescription: string;
  hours: number;
  entryType: "Work" | "Leave" | "Meeting";
  jiraTaskId?: string;
}

interface TimeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: TimeEntryFormValues) => Promise<void>;
  initialValues?: Partial<TimeEntryFormValues>;
  title: string;
  submitText: string;
}

export const TimeEntryModal: React.FC<TimeEntryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialValues,
  title,
  submitText,
}) => {
  const [form, setForm] = useState<TimeEntryFormValues>({
    workDate: "",
    projectName: "",
    taskDescription: "",
    hours: 8,
    entryType: "Work",
    jiraTaskId: "",
    ...initialValues,
  });

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({
        workDate: "",
        projectName: "",
        taskDescription: "",
        hours: 8,
        entryType: "Work",
        jiraTaskId: "",
        ...initialValues,
      });
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    setError(null);

    if (!form.workDate) { setError("Date is required."); return; }
    if (!form.taskDescription) { setError("Task Description is required."); return; }
    if (form.hours < 0.5 || form.hours > 24) { setError("Hours must be between 0.5 and 24."); return; }

    if (form.entryType === "Work") {
      if (!form.projectName?.trim()) { setError("Project Name is required for Work entries."); return; }
      if (!form.jiraTaskId?.trim()) { setError("Jira Task ID is required for Work entries."); return; }
      if (!/^[A-Z]+-\d+$/.test(form.jiraTaskId)) { setError("Jira Task ID must be in format ABC-123."); return; }
    } else if (form.jiraTaskId && form.jiraTaskId.trim() !== "" && !/^[A-Z]+-\d+$/.test(form.jiraTaskId)) {
      setError("Jira Task ID must be in format ABC-123.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const getDescPlaceholder = () => {
    if (form.entryType === "Leave") return "Reason for leave";
    if (form.entryType === "Meeting") return "Meeting details";
    return "What did you work on?";
  };

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000,
      backdropFilter: "blur(4px)",
    }}>
      <div style={{
        background: "white", borderRadius: "12px",
        width: "100%", maxWidth: "450px",
        boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
        display: "flex", flexDirection: "column", maxHeight: "90vh",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--neutral-100)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--neutral-400)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
          {/* Entry Type */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Entry Type</label>
            <select className="input" value={form.entryType} onChange={e => setForm({ ...form, entryType: e.target.value as TimeEntryFormValues["entryType"] })}>
              <option value="Work">Work</option>
              <option value="Meeting">Meeting</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Date</label>
            <input className="input" type="date" value={form.workDate} onChange={e => setForm({ ...form, workDate: e.target.value })} />
          </div>

          {/* Project Name — hidden for Leave */}
          {form.entryType !== "Leave" && (
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>
                Project Name {form.entryType === "Meeting" && <span style={{ color: "var(--neutral-400)", fontWeight: 400 }}>(Optional)</span>}
              </label>
              <input className="input" placeholder="e.g. SipraHub Intranet" value={form.projectName || ""} onChange={e => setForm({ ...form, projectName: e.target.value })} />
            </div>
          )}

          {/* Jira Task ID — hidden for Leave */}
          {form.entryType !== "Leave" && (
            <div>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>
                Jira Task ID {form.entryType === "Meeting" && <span style={{ color: "var(--neutral-400)", fontWeight: 400 }}>(Optional)</span>}
              </label>
              <input
                className="input"
                placeholder="e.g. SIPRA-123"
                value={form.jiraTaskId || ""}
                onChange={e => setForm({ ...form, jiraTaskId: e.target.value.toUpperCase() })}
              />
            </div>
          )}

          {/* Task Description */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--neutral-600)", display: "block", marginBottom: "6px" }}>Task Description</label>
            <textarea
              className="input"
              placeholder={getDescPlaceholder()}
              style={{ height: "80px", resize: "none", padding: "10px" }}
              value={form.taskDescription}
              onChange={e => setForm({ ...form, taskDescription: e.target.value })}
            />
          </div>

          {/* Hours */}
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

        {/* Footer */}
        <div style={{ padding: "16px 24px", background: "var(--neutral-50)", display: "flex", justifyContent: "flex-end", gap: "12px", flexShrink: 0 }}>
          <button className="btn btn--secondary" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : submitText}
          </button>
        </div>
      </div>
    </div>
  );
};
