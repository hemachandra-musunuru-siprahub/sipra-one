import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Users, Search, Download } from "lucide-react";
import { getUsers } from "../../api/users";
import type { User } from "../../api/types";

interface Props { internalUser: any; }

export const HREmployeesPage = ({ internalUser }: Props) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

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
    const matchesSearch = (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filter === "all" ? true : filter === "active" ? u.is_active : !u.is_active;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout internalUser={internalUser} role="HR">
      <header className="page-header">
        <div className="breadcrumb"><span>HR</span><span className="breadcrumb__separator">/</span><span>Employees</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Employee Directory</h1>
          <button className="btn btn--secondary"><Download size={16} /> Export CSV</button>
        </div>
      </header>
      <div className="card">
        <div className="card__header">
          <h3 className="card__title"><Users size={18} style={{ marginRight: "var(--space-2)" }} /> All Employees</h3>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <div className="topbar__search" style={{ border: "1px solid var(--neutral-200)", borderRadius: "var(--rounded-md)", padding: "0 var(--space-3)" }}>
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
            <thead><tr><th>Employee</th><th>Email</th><th>Manager</th><th>Status</th><th>Last Login</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading employee data…</td></tr>
                : errorMsg ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--error-500)" }}>Error: {errorMsg}</td></tr>
                  : filtered.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No employees found.</td></tr>
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
                        <td><span className={`badge ${u.is_active ? "badge--published" : "badge--draft"}`}>{u.is_active ? "Active" : "Inactive"}</span></td>
                        <td style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never"}</td>
                      </tr>
                    ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
};
