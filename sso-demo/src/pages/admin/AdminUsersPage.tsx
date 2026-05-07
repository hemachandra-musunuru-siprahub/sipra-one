import React, { useState, useEffect, useRef, useCallback } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Users, CheckCircle, XCircle, RefreshCw, Search, X } from "lucide-react";
import { setActive, setManager, getManagers } from "../../api/users";
import { getAllUsers, deleteUser } from "../../api/admin";

interface Props { internalUser: any; }

// ─── Role badge styling ───────────────────────────────────────────────────────
const ROLE_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  Admin:    { label: "Admin",    bg: "#FEF3F2", color: "#B42318" },
  HR:       { label: "HR",       bg: "#F0FDF4", color: "#15803D" },
  Manager:  { label: "Manager",  bg: "#EFF6FF", color: "#1D4ED8" },
  Employee: { label: "Employee", bg: "#F9FAFB", color: "#374151" },
};

// ─── Read-only role badge (always synced from Microsoft Entra ID) ─────────────
function RoleBadge({ role }: { role: string | null }) {
  const style = role ? (ROLE_STYLES[role] ?? { label: role, bg: "#F9FAFB", color: "#374151" }) : null;
  if (!style) {
    return (
      <span style={{
        display: "inline-block", padding: "2px 8px", borderRadius: 9999,
        fontSize: "0.75rem", fontWeight: 500, background: "#FEF9C3", color: "#854D0E",
      }}>
        Not Synced
      </span>
    );
  }
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 9999,
      fontSize: "0.75rem", fontWeight: 600, background: style.bg, color: style.color,
      textTransform: "capitalize",
    }}>
      {style.label}
    </span>
  );
}


// ─── Manager Picker ───────────────────────────────────────────────────────────
// Fetches ONLY users with role='Manager' from the API.
// Local filtering happens client-side after fetch; search debounce triggers re-fetch.
interface ManagerPickerProps {
  currentManagerOid: string | null;
  onSelect: (oid: string | null) => Promise<void>;
  onCancel: () => void;
}

const ManagerPicker: React.FC<ManagerPickerProps> = ({
  currentManagerOid,
  onSelect,
  onCancel,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  const [query, setQuery]       = useState("");
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [open, setOpen]         = useState(true);

  // Fetch managers from API (only role='Manager' users)
  const fetchManagers = useCallback(async (search?: string) => {
    setLoading(true);
    try {
      const data = await getManagers(search);
      setManagers(data.managers || []);
    } catch {
      setManagers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchManagers(); }, [fetchManagers]);

  // Debounced search re-fetch
  useEffect(() => {
    const t = setTimeout(() => fetchManagers(query.trim() || undefined), 300);
    return () => clearTimeout(t);
  }, [query, fetchManagers]);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel]);

  const handleSelect = async (oid: string | null) => {
    setSaving(true);
    setOpen(false);
    try { await onSelect(oid); }
    finally { setSaving(false); }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: 280 }}>
      {/* Search input */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        border: "1.5px solid var(--primary-400)", borderRadius: "var(--rounded-lg)",
        background: "white", padding: "4px 8px",
      }}>
        <Search size={13} style={{ color: "var(--neutral-400)", flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search manager by name or email…"
          style={{
            border: "none", outline: "none", fontSize: "0.8125rem",
            flex: 1, background: "transparent", color: "var(--neutral-800)",
          }}
          disabled={saving}
        />
        {saving ? (
          <div style={{
            width: 14, height: 14, border: "2px solid var(--primary-400)",
            borderTopColor: "transparent", borderRadius: "50%",
            animation: "spin 0.7s linear infinite", flexShrink: 0,
          }} />
        ) : (
          <button
            onClick={onCancel}
            style={{ border: "none", background: "none", cursor: "pointer", padding: 0, display: "flex", color: "var(--neutral-400)" }}
            title="Cancel"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown panel */}
      {open && !saving && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "white", border: "1px solid var(--neutral-200)",
          borderRadius: "var(--rounded-xl)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 200, maxHeight: 280, overflowY: "auto",
        }}>
          {/* Clear option */}
          <button
            onClick={() => handleSelect(null)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", background: "none", border: "none",
              borderBottom: "1px solid var(--neutral-100)", cursor: "pointer",
              textAlign: "left",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#FEF2F2")}
            onMouseLeave={e => (e.currentTarget.style.background = "none")}
          >
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: "#FEF3F2", border: "1.5px dashed #FECACA",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <X size={12} style={{ color: "#B42318" }} />
            </div>
            <span style={{ fontSize: "0.8125rem", color: "var(--neutral-500)", fontStyle: "italic" }}>
              — No manager (clear assignment) —
            </span>
          </button>

          {/* Manager list */}
          {loading ? (
            <div style={{ padding: "14px 16px", fontSize: "0.8125rem", color: "var(--neutral-400)", textAlign: "center" }}>
              Loading managers…
            </div>
          ) : managers.length === 0 ? (
            <div style={{ padding: "14px 16px", fontSize: "0.8125rem", color: "var(--neutral-400)", textAlign: "center" }}>
              No managers found
            </div>
          ) : managers.map(u => {
            const isCurrentManager = u.entra_oid === currentManagerOid;
            return (
              <button
                key={u.entra_oid}
                onClick={() => handleSelect(u.entra_oid)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", background: isCurrentManager ? "#F0F7FF" : "none",
                  border: "none", cursor: "pointer", textAlign: "left",
                  borderBottom: "1px solid var(--neutral-50)",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (!isCurrentManager) e.currentTarget.style.background = "var(--neutral-50)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isCurrentManager ? "#F0F7FF" : "none"; }}
              >
                {/* Avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                  background: "#1D4ED8", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.7rem", fontWeight: 700,
                }}>
                  {u.name?.[0]?.toUpperCase() ?? "?"}
                </div>

                {/* Name + email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "0.8125rem", fontWeight: 600,
                    color: "var(--neutral-800)", whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {u.name}
                    {isCurrentManager && (
                      <span style={{ fontSize: "0.65rem", color: "#1D4ED8", marginLeft: 6, fontWeight: 500 }}>
                        current
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: "0.7rem", color: "var(--neutral-500)",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {u.email}
                  </div>
                </div>

                {/* Manager badge */}
                <span style={{
                  flexShrink: 0, padding: "2px 7px", borderRadius: 9999,
                  fontSize: "0.65rem", fontWeight: 700,
                  background: "#EFF6FF", color: "#1D4ED8",
                }}>
                  Manager
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const AdminUsersPage = ({ internalUser }: Props) => {
  const [users, setUsers]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [error, setError]           = useState<string | null>(null);

  const loadUsers = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const data = await getAllUsers();
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

  const handlePickManager = async (userOid: string, selectedOid: string | null) => {
    const { user: updated } = await setManager(userOid, selectedOid);
    setUsers(prev => prev.map(u => u.entra_oid === userOid ? { ...u, ...updated } : u));
    setEditingId(null);
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
              title="Refresh user list"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={14} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              {refreshing ? "Refreshing…" : "Refresh"}
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
                <th>Entra Role</th>
                <th>Manager</th>
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
                  {/* Name */}
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                      <div className="avatar avatar--sm" style={{ width: 28, height: 28 }}>
                        {user.name?.[0] ?? "?"}
                      </div>
                      <span style={{ fontWeight: 500 }}>{user.name}</span>
                    </div>
                  </td>

                  {/* Email */}
                  <td style={{ fontSize: "0.875rem" }}>{user.email}</td>

                  {/* Role — read-only, always synced from Microsoft Entra ID */}
                  <td>
                    <RoleBadge role={user.role} />
                  </td>

                  {/* Manager — picker or display */}
                  <td style={{ minWidth: 200 }}>
                    {editingId === user.entra_oid ? (
                      <ManagerPicker
                        currentManagerOid={user.manager_entra_oid}
                        onSelect={(oid) => handlePickManager(user.entra_oid, oid)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : user.manager_name ? (
                      <div
                        style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", cursor: "pointer" }}
                        onClick={() => setEditingId(user.entra_oid)}
                        title="Click to change manager"
                      >
                        <div
                          className="avatar avatar--sm"
                          style={{ width: 24, height: 24, fontSize: "0.65rem", flexShrink: 0, background: "var(--dept-it)" }}
                        >
                          {user.manager_name[0]?.toUpperCase()}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontSize: "0.8125rem", fontWeight: 600, color: "var(--neutral-800)",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160,
                          }}>
                            {user.manager_name}
                          </div>
                          <div style={{
                            fontSize: "0.7rem", color: "var(--neutral-500)",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160,
                          }}>
                            {user.manager_email}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span
                        style={{ fontSize: "0.8125rem", color: "var(--neutral-400)", cursor: "pointer" }}
                        onClick={() => setEditingId(user.entra_oid)}
                        title="Click to assign a manager"
                      >
                        No manager
                      </span>
                    )}
                  </td>

                  {/* Status */}
                  <td>
                    <span className={`badge ${user.is_active ? "badge--published" : "badge--draft"}`}>
                      {user.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  {/* Last Login */}
                  <td style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : "Never"}
                  </td>

                  {/* Actions */}
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
          <p style={{ fontSize: "0.75rem", color: "var(--neutral-500)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px",
              background: "#EFF6FF", color: "#1D4ED8", borderRadius: 9999,
              fontSize: "0.7rem", fontWeight: 600,
            }}>
              🔒 Synced from Microsoft Entra ID
            </span>
            Roles are managed in Microsoft Entra and automatically synchronized on every login.
            Role editing is not available in SipraHub.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
};
