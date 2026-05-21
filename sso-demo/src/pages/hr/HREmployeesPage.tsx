import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Search, Calendar, X } from "lucide-react";
import { getUsers } from "../../api/users";
import { updateEmployeeDOJ } from "../../api/admin";
import type { User } from "../../api/types";

interface Props { internalUser: any; }

interface EnrichedUser extends User {
  manager_name?: string;
  manager_email?: string;
}

export const HREmployeesPage = ({ internalUser }: Props) => {
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // DOJ modal state
  const [dojTarget, setDojTarget] = useState<EnrichedUser | null>(null);
  const [dojValue, setDojValue] = useState("");
  const [dojSaving, setDojSaving] = useState(false);
  const [dojError, setDojError] = useState("");

  const role = internalUser?.role || "HR";
  const isAdmin = role === "Admin";

  useEffect(() => {
    getUsers()
      .then(d => {
        if (!d || !d.users) setErrorMsg("API response is missing users array.");
        else setUsers(d.users);
      })
      .catch(e => {
        console.error(e);
        setErrorMsg(e.message || "Failed to fetch users");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    const matchesSearch =
      (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filter === "all" ? true : filter === "active" ? u.is_active : !u.is_active;
    return matchesSearch && matchesStatus;
  });

  const openDojModal = (u: EnrichedUser) => {
    setDojTarget(u);
    setDojValue(u.date_of_joining ? u.date_of_joining.slice(0, 10) : "");
    setDojError("");
  };

  const handleSaveDoj = async () => {
    if (!dojTarget) return;
    if (!dojValue) { setDojError("Please select a date."); return; }
    setDojSaving(true);
    setDojError("");
    try {
      await updateEmployeeDOJ(dojTarget.entra_oid, dojValue);
      setUsers(prev => prev.map(u =>
        u.entra_oid === dojTarget.entra_oid ? { ...u, date_of_joining: dojValue } : u
      ));
      setDojTarget(null);
    } catch (e: any) {
      setDojError(e.message || "Failed to save.");
    } finally {
      setDojSaving(false);
    }
  };

  return (
    <DashboardLayout internalUser={internalUser} role={role}>
      <header className="page-header">
        <h1 className="page-title">Employee Directory</h1>
      </header>
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Employees</h3>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <div className="topbar__search">
              <Search size={16} color="var(--neutral-400)" />
              <input className="topbar__search-input" placeholder="Search employees…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input" style={{ width: 150 }} value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Email</th>
                <th>Manager</th>
                <th>Date of Joining</th>
                <th>Status</th>
                <th>Last Login</th>
                {isAdmin && <th style={{ textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading employee data…</td></tr>
                : errorMsg
                  ? <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: "center", color: "var(--error-500)" }}>Error: {errorMsg}</td></tr>
                  : filtered.length === 0
                    ? <tr><td colSpan={isAdmin ? 7 : 6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No employees found.</td></tr>
                    : filtered.map(u => (
                      <tr key={u.entra_oid}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                            <div className="avatar avatar--sm" style={{ width: 28, height: 28 }}>{(u.name || "U")[0]}</div>
                            <span style={{ fontWeight: 500 }}>{u.name || u.entra_oid.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: "0.875rem" }}>{u.email}</td>
                        <td>
                          {u.manager_name ? (
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--neutral-800)" }}>{u.manager_name}</span>
                              <span style={{ fontSize: "0.7rem", color: "var(--neutral-500)" }}>{u.manager_email}</span>
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.8125rem", color: "var(--neutral-400)" }}>No manager</span>
                          )}
                        </td>
                        <td style={{ fontSize: "0.8125rem" }}>
                          {u.date_of_joining
                            ? new Date(u.date_of_joining).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                            : <span style={{ color: "var(--neutral-300)" }}>—</span>}
                        </td>
                        <td><span className={`badge ${u.is_active ? "badge--published" : "badge--draft"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
                        <td style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
                          {u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}
                        </td>
                        {isAdmin && (
                          <td style={{ textAlign: "right" }}>
                            <button
                              className="btn btn--secondary"
                              style={{ fontSize: "0.75rem", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 5 }}
                              onClick={() => openDojModal(u)}
                            >
                              <Calendar size={12} /> Set DOJ
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Set DOJ Modal ──────────────────────────────────────────────────────── */}
      {dojTarget && (
        <div className="modal-overlay" onClick={() => setDojTarget(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Set Date of Joining</div>
              <button className="topbar__icon-btn" onClick={() => setDojTarget(null)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              <div style={{ marginBottom: "var(--space-3)", fontSize: "0.875rem", color: "var(--neutral-600)" }}>
                Employee: <strong>{dojTarget.name}</strong>
              </div>
              <div className="form-field--compact">
                <label className="form-label--compact">Date of Joining <span style={{ color: "var(--error-500)" }}>*</span></label>
                <input
                  type="date"
                  className="form-input--compact"
                  value={dojValue}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={e => setDojValue(e.target.value)}
                />
              </div>
              {dojError && (
                <div style={{ marginTop: "var(--space-2)", fontSize: "0.8125rem", color: "var(--error-600)" }}>{dojError}</div>
              )}
              <div style={{ marginTop: "var(--space-3)", padding: "8px 12px", background: "#FFFBEB", border: "1px solid #FEF3C7", borderRadius: 6, fontSize: "0.75rem", color: "#92400E" }}>
                Leave credits will fire on the DOJ day each month. First credit fires on the joining date itself.
              </div>
            </div>
            <div className="modal__footer" style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <button className="btn btn--secondary" onClick={() => setDojTarget(null)}>Cancel</button>
              <button className="btn btn--primary" onClick={handleSaveDoj} disabled={dojSaving}>
                {dojSaving ? "Saving…" : "Save DOJ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
