import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Users, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { setActive, setManager } from "../../api/users";
import { getAdminUsers, deleteUser } from "../../api/admin";

interface Props { internalUser: any; }

// ─── Role badge styling ───────────────────────────────────────────────────────
const ROLE_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  admin:    { label: "Admin",      bg: "#FEF3F2", color: "#B42318" },
  hr:       { label: "HR",         bg: "#F0FDF4", color: "#15803D" },
  manager:  { label: "Manager",    bg: "#EFF6FF", color: "#1D4ED8" },
  employee: { label: "Employee",   bg: "#F9FAFB", color: "#374151" },
};

function RoleBadge({ role }: { role: string | null }) {
  if (!role) {
    return (
      <span style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 9999,
        fontSize: "0.75rem",
        fontWeight: 500,
        background: "#FEF9C3",
        color: "#854D0E",
      }}>
        Not Synced
      </span>
    );
  }

  const style = ROLE_STYLES[role] ?? { label: role, bg: "#F9FAFB", color: "#374151" };
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 9999,
      fontSize: "0.75rem",
      fontWeight: 600,
      background: style.bg,
      color: style.color,
      textTransform: "capitalize",
    }}>
      {style.label}
    </span>
  );
}

export const AdminUsersPage = ({ internalUser }: Props) => {
  const [users, setUsers]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managerOid, setManagerOid] = useState("");
  const [search, setSearch]       = useState("");
  const [error, setError]         = useState<string | null>(null);

  const loadUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await getAdminUsers();
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message || "Failed to load users");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleActive = async (oid: string, current: boolean) => {
    try {
      const { user } = await setActive(oid, !current);
      setUsers(prev => prev.map(u => u.entra_oid === oid ? { ...u, ...user } : u));
    } catch (e) { console.error(e); }
  };

  const handleSetManager = async (oid: string) => {
    try {
      const mgr = managerOid.trim() || null;
      const { user } = await setManager(oid, mgr);
      setUsers(prev => prev.map(u => u.entra_oid === oid ? { ...u, ...user } : u));
      setEditingId(null);
      setManagerOid("");
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (oid: string) => {
    if (!window.confirm(
      "Are you sure you want to delete this account from SipraHub?\n" +
      "This only removes the local account — the Microsoft Entra ID is not affected."
    )) return;
    try {
      await deleteUser(oid);
      loadUsers(true);
    } catch (e: any) { alert(e.message); }
  };

  const activeCount   = users.filter(u => u.is_active).length;
  const inactiveCount = users.filter(u => !u.is_active).length;

  return (
    <DashboardLayout internalUser={internalUser} role="Admin">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Admin</span><span className="breadcrumb__separator">/</span><span>User Management</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">User Management</h1>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "0.875rem", color: "var(--neutral-600)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <CheckCircle size={14} style={{ color: "var(--success-500)" }} /> {activeCount} active
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <XCircle size={14} style={{ color: "var(--error-500)" }} /> {inactiveCount} inactive
              </span>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => loadUsers(true)}
              disabled={refreshing}
              title="Refresh roles from Microsoft Entra ID"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={14} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              {refreshing ? "Refreshing…" : "Refresh Roles"}
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div style={{
          padding: "var(--space-4)", background: "#FEF2F2", border: "1px solid #FECACA",
          borderRadius: "var(--rounded-lg)", color: "#B91C1C", marginBottom: "var(--space-4)",
          fontSize: "0.875rem",
        }}>
          ⚠️ {error}
        </div>
      )}

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">
            <Users size={18} style={{ marginRight: "var(--space-2)" }} /> All Users
          </h3>
          <input
            className="input"
            style={{ width: 260 }}
            placeholder="Search by name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Microsoft Entra Role</th>
                <th>Manager OID</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-500)", padding: "var(--space-8)" }}>
                  Loading users and resolving roles from Microsoft Entra ID…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No users found</td></tr>
              ) : filtered.map(user => (
                <tr key={user.entra_oid}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <div className="avatar avatar--sm" style={{ width: 28, height: 28 }}>
                        {user.name?.[0] ?? "?"}
                      </div>
                      <span style={{ fontWeight: 500 }}>{user.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: "0.875rem" }}>{user.email}</td>
                  <td>
                    <RoleBadge role={user.roleFromEntra} />
                  </td>
                  <td>
                    {editingId === user.entra_oid ? (
                      <div style={{ display: "flex", gap: "var(--space-2)" }}>
                        <input
                          className="input"
                          style={{ fontSize: "0.75rem", padding: "4px 8px", width: 180 }}
                          placeholder="Manager OID or blank to clear"
                          value={managerOid}
                          onChange={e => setManagerOid(e.target.value)}
                        />
                        <button className="btn btn--primary btn--sm" style={{ height: 28 }} onClick={() => handleSetManager(user.entra_oid)}>Save</button>
                        <button className="btn btn--ghost btn--sm" style={{ height: 28 }} onClick={() => setEditingId(null)}>✕</button>
                      </div>
                    ) : (
                      <span
                        style={{
                          fontFamily: "monospace", fontSize: "0.75rem",
                          color: user.manager_entra_oid ? "var(--neutral-700)" : "var(--neutral-400)",
                          cursor: "pointer",
                        }}
                        onClick={() => { setEditingId(user.entra_oid); setManagerOid(user.manager_entra_oid || ""); }}
                        title="Click to edit"
                      >
                        {user.manager_entra_oid ? user.manager_entra_oid.slice(0, 14) + "…" : "No manager"}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${user.is_active ? "badge--published" : "badge--draft"}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : "Never"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <button
                        className={`btn btn--sm ${user.is_active ? "btn--secondary" : "btn--primary"}`}
                        style={{ height: 28, fontSize: "0.75rem" }}
                        onClick={() => handleToggleActive(user.entra_oid, user.is_active)}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        className="btn btn--sm btn--danger"
                        style={{ height: 28, fontSize: "0.75rem", backgroundColor: "var(--error-500)", color: "white" }}
                        onClick={() => handleDeleteUser(user.entra_oid)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card__footer">
          <p style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
            Roles are resolved in real-time from <strong>Microsoft Entra ID</strong> app role assignments.
            No role data is stored in the local database. Click <em>Refresh Roles</em> to re-fetch.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};
