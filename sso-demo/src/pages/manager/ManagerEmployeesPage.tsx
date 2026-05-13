import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Search } from "lucide-react";
import { getTeamMembers } from "../../api/users";
import type { User } from "../../api/types";

interface Props { internalUser: any; }

export const ManagerEmployeesPage = ({ internalUser }: Props) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getTeamMembers()
      .then(team => {
        if (!Array.isArray(team)) {
          if ((team as any).users) {
            setUsers((team as any).users);
          } else {
            setUsers([]);
            setErrorMsg("Invalid team members format.");
          }
        } else {
          setUsers(team);
        }
      })
      .catch(e => {
        console.error(e);
        setErrorMsg(e.message || "Failed to fetch team members");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u => {
    return (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
           (u.email || "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "Manager"}>
      <header className="page-header">
        <h1 className="page-title">My Team</h1>
      </header>
      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Employees</h3>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <div className="topbar__search" style={{ border: "1px solid var(--neutral-200)", borderRadius: "var(--rounded-md)", padding: "0 var(--space-3)" }}>
              <Search size={16} color="var(--neutral-400)" />
              <input className="topbar__search-input" placeholder="Search team members…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Employee</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading team data…</td></tr>
                : errorMsg ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--error-500)" }}>Error: {errorMsg}</td></tr>
                  : filtered.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No team members found.</td></tr>
                    : filtered.map(u => (
                      <tr key={u.entra_oid}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                            <div className="avatar avatar--sm" style={{ width: 28, height: 28 }}>{(u.name || "U")[0]}</div>
                            <span style={{ fontWeight: 500 }}>{u.name || u.entra_oid.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: "0.875rem" }}>{u.email}</td>
                        <td style={{ fontSize: "0.875rem" }}>{u.role || u.designation || "Employee"}</td>
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
