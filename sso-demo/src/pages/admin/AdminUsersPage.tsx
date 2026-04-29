import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Users, Shield, Activity, CheckCircle, XCircle } from "lucide-react";
import { getUsers, setActive, setManager } from "../../api/users";
import type { User } from "../../api/types";

import { deleteUser } from "../../api/admin";

interface Props { internalUser: any; }

export const AdminUsersPage = ({ internalUser }: Props) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [managerOid, setManagerOid] = useState("");
  const [search, setSearch] = useState("");

  const loadUsers = () => {
    getUsers().then(d => setUsers(d.users)).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleActive = async (oid: string, current: boolean) => {
    try {
      const { user } = await setActive(oid, !current);
      setUsers(prev => prev.map(u => u.entra_oid === oid ? user : u));
    } catch (e) { console.error(e); }
  };

  const handleSetManager = async (oid: string) => {
    try {
      const mgr = managerOid.trim() || null;
      const { user } = await setManager(oid, mgr);
      setUsers(prev => prev.map(u => u.entra_oid === oid ? user : u));
      setEditingId(null); setManagerOid("");
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (oid: string) => {
    if (!window.confirm("Are you sure you want to delete this account from SipraHub? This action only removes the local account, not the Microsoft Entra ID.")) return;
    try {
      await deleteUser(oid);
      loadUsers();
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
          <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "0.875rem", color: "var(--neutral-600)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              <CheckCircle size={14} style={{ color: "var(--success-500)" }} /> {activeCount} active
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              <XCircle size={14} style={{ color: "var(--error-500)" }} /> {inactiveCount} inactive
            </span>
          </div>
        </div>
      </header>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title"><Users size={18} style={{ marginRight: "var(--space-2)" }} /> All Users</h3>
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
                <th>Role</th>
                <th>Manager OID</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading users…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No users found</td></tr>
              ) : filtered.map(user => (
                <tr key={user.entra_oid}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <div className="avatar avatar--sm" style={{ width: 28, height: 28 }}>{user.name[0]}</div>
                      <span style={{ fontWeight: 500 }}>{user.name}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: "0.875rem" }}>{user.email}</td>
                  <td>
                    <span className="badge badge--secondary" style={{ textTransform: "capitalize" }}>
                      {user.effective_role ? user.effective_role : "Not Synced"}
                    </span>
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
                        style={{ fontFamily: "monospace", fontSize: "0.75rem", color: user.manager_entra_oid ? "var(--neutral-700)" : "var(--neutral-400)", cursor: "pointer" }}
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
            Roles are managed in Microsoft Entra ID. Click a Manager OID to assign/change.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};
