import { useMsal } from "@azure/msal-react";
import { useState, useEffect } from "react";
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate,
} from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { clearSessionCache } from "./components/LoginHandler";
import { ManagerDashboard } from "./components/ManagerDashboard";
import { HRDashboard } from "./components/HRDashboard";
import { EmployeeDashboard } from "./components/EmployeeDashboard";
import { AccessDenied } from "./components/AccessDenied";
import { DashboardLayout } from "./components/DashboardLayout";
import {
  Shield, Users,
  Database, Globe, PieChart, HardDrive, Settings
} from "lucide-react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import type { UserRole } from "./lib/roleHelper";

// Pages
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { AdminSettingsPage } from "./pages/admin/AdminSettingsPage";
import { EmployeeLeavePage } from "./pages/employee/EmployeeLeavePage";
import { EmployeeTimesheetPage } from "./pages/employee/EmployeeTimesheetPage";
import { AnnouncementsPage } from "./pages/shared/AnnouncementsPage";
import { DocumentsPage } from "./pages/shared/DocumentsPage";
import { ManagerApprovalsPage } from "./pages/manager/ManagerApprovalsPage";
import { ManagerTimesheetsPage } from "./pages/manager/ManagerTimesheetsPage";
import { ManagerEmployeesPage } from "./pages/manager/ManagerEmployeesPage";
import { HREmployeesPage } from "./pages/hr/HREmployeesPage";
import { HRLeavePage } from "./pages/hr/HRLeavePage";
import { HRLeavePoliciesPage } from "./pages/hr/HRLeavePoliciesPage";
import { HRTimeSheetsPage } from "./pages/hr/HRTimeSheetsPage";
import { AnnouncementDetailPage } from "./pages/shared/AnnouncementDetailPage";
import { PerformancePage } from "./pages/shared/PerformancePage";
import { LandingPage } from "./pages/shared/LandingPage";
import { LoginPage } from "./pages/shared/LoginPage";
import { HolidayCalendarPage } from "./pages/admin/HolidayCalendarPage";
import { HolidayViewPage } from "./pages/shared/HolidayViewPage";

// API
import { getAllUsers, deleteUser } from "./api/admin";
import { setActive } from "./api/users";


// ─── API base ─────────────────────────────────────────────────────────────────
const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────
interface InternalUser {
  id?: number;
  entra_oid?: string;
  name?: string;
  email?: string;
  role?: UserRole;              // Canonical role from the DB: "Admin" | "HR" | "Manager" | "Employee"
  is_active?: boolean;
  manager_entra_oid?: string;
}

// ─── Role helpers (single string from DB) ────────────────────────────────────
const isAdminRole = (r: string) => r === "Admin";
const isHRRole = (r: string) => r === "HR";
const isManagerRole = (r: string) => r === "Manager";
const isEmployeeRole = (r: string) => r === "Employee" || r === "Admin" || r === "HR" || r === "Manager";

function getRedirectPath(role: string): string {
  if (isAdminRole(role)) return "/admin-dashboard";
  if (isHRRole(role)) return "/hr/dashboard";
  if (isManagerRole(role)) return "/manager/dashboard";
  return "/employee-dashboard";
}

// ─── Role Guard ───────────────────────────────────────────────────────────────
function RoleGuard({ children, allowed, internalUser }: {
  children: React.ReactNode;
  allowed: (role: string) => boolean;
  internalUser: InternalUser | null;
}) {
  if (!internalUser) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <p style={{ color: "var(--neutral-50)", fontFamily: "Inter, sans-serif" }}>Loading session…</p>
      </div>
    );
  }
  const role = internalUser.role || "Employee";
  if (isAdminRole(role) || allowed(role)) return <>{children}</>;
  return <Navigate to="/access-denied" replace />;
}

// ─── Root redirect ────────────────────────────────────────────────────────────
function RootRedirect({ internalUser }: { internalUser: InternalUser | null }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!internalUser) return;
    navigate(getRedirectPath(internalUser.role || "Employee"), { replace: true });
  }, [internalUser, navigate]);
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <p style={{ color: "var(--neutral-50)", fontFamily: "Inter, sans-serif" }}>Redirecting to your dashboard…</p>
    </div>
  );
}



// ─── Admin Dashboard ──────────────────────────────────────────────────────────
const AdminDashboard = ({ internalUser }: { internalUser: InternalUser | null }) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getAllUsers();
      setUsers(data.users || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleActive = async (oid: string, current: boolean) => {
    try {
      await setActive(oid, !current);
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteUser = async (oid: string) => {
    if (!window.confirm("Are you sure you want to delete this account from SipraHub? This action only removes the local account, not the Microsoft Entra ID.")) return;
    try {
      await deleteUser(oid);
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const UserTable = ({ userList, title }: { userList: any[], title: string }) => (
    <div className="card" style={{ marginBottom: "var(--space-6)" }}>
      <div className="card__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="card__title">{title} ({userList.length})</h3>
        <button className="btn btn--ghost btn--sm" onClick={() => navigate("/admin/users")}>Manage All</button>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Manager</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {userList.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)", padding: "var(--space-6)" }}>No users found.</td></tr>
            ) : userList.map(user => (
              <tr key={user.entra_oid}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <div className="avatar avatar--sm" style={{ width: 24, height: 24, fontSize: "0.75rem" }}>{user.name[0]}</div>
                    <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{user.name}</span>
                  </div>
                </td>
                <td style={{ fontSize: "0.8125rem" }}>{user.email}</td>
                <td>
                  {user.manager_name ? (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--neutral-800)" }}>{user.manager_name}</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--neutral-500)" }}>{user.manager_email}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: "0.75rem", color: "var(--neutral-400)" }}>—</span>
                  )}
                </td>
                <td><span className={`badge ${user.is_active ? "badge--published" : "badge--draft"}`} style={{ fontSize: "0.6875rem" }}>{user.is_active ? "Active" : "Inactive"}</span></td>
                <td style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{user.last_login ? new Date(user.last_login).toLocaleDateString() : "Never"}</td>
                <td>
                  <div style={{ display: "flex", gap: "var(--space-1)" }}>
                    <button className="btn btn--ghost btn--sm" style={{ color: user.is_active ? "var(--error-500)" : "var(--success-500)" }} onClick={() => handleToggleActive(user.entra_oid, user.is_active)}>
                      {user.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button className="btn btn--ghost btn--sm" style={{ color: "var(--error-600)" }} onClick={() => handleDeleteUser(user.entra_oid)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "Admin"}>
      <header className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Systems Control</h1>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--secondary" onClick={() => navigate("/admin/users")}><Users size={16} /> User Management</button>
            <button className="btn btn--secondary" onClick={() => navigate("/admin/settings")}><Settings size={16} /> System Settings</button>
            <button className="btn btn--primary" onClick={() => navigate("/admin/health")}><Shield size={16} /> System Health</button>
          </div>
        </div>
      </header>

      <div style={{
        background: "linear-gradient(120deg, var(--primary-700) 0%, var(--primary-500) 100%)",
        borderRadius: "12px",
        padding: "16px 24px",
        marginBottom: "var(--space-6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        minHeight: "72px",
      }}>
        <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20px", right: "80px", width: "70px", height: "70px", borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "white", margin: 0 }}>
            Welcome back, {internalUser?.name?.split(" ")[0] || "there"}!
          </h2>
        </div>
        <div style={{ position: "relative", zIndex: 1, textAlign: "right" }}>
          <div style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </div>

      <div className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
        <div className="card">
          <div className="card__header" style={{ borderBottom: "1px solid var(--neutral-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 className="card__title">Users</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>Roles are managed by Microsoft Entra ID</span>
          </div>
          <div className="card__body">
            {loading ? (
              <div style={{ textAlign: "center", padding: "var(--space-8)", color: "var(--neutral-500)" }}>Fetching users…</div>
            ) : (
              <UserTable userList={users} title="Registered Users" />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card__header"><h3 className="card__title">Operational Health</h3></div>
          <div className="card__body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "var(--space-6)" }}>
              {[
                { icon: <Globe size={18} style={{ color: "var(--primary-500)" }} />, label: "SSO Connectivity", value: "Active", sub: "Entra ID v2.0" },
                { icon: <Database size={18} style={{ color: "var(--success-500)" }} />, label: "Local Database", value: "Connected", sub: "PostgreSQL" },
                { icon: <HardDrive size={18} style={{ color: "var(--dept-finance)" }} />, label: "Audit Logs", value: "Enabled", sub: "Tracking local changes" },
                { icon: <PieChart size={18} style={{ color: "var(--dept-it)" }} />, label: "API Sync", value: "Synced", sub: "Latest profile data" },
              ].map((item, idx) => (
                <div key={idx} style={{ padding: "var(--space-5)", background: "var(--neutral-50)", borderRadius: "var(--rounded-xl)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
                    {item.icon}<span style={{ fontWeight: 600 }}>{item.label}</span>
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "var(--space-1)" }}>{item.value}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{item.sub}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card__footer">
            <p style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>Role information is derived dynamically from Microsoft Entra ID and manager relationships. No role data is stored in the local database.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

// ─── Admin Health page ────────────────────────────────────────────────────────
const AdminHealthPage = ({ internalUser }: { internalUser: InternalUser | null }) => {
  const [health, setHealth] = useState<any>(null);
  useEffect(() => {
    fetch(`${API}/health`, { credentials: "include" }).then(r => r.json()).then(setHealth).catch(console.error);
  }, []);
  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "Admin"}>
      <header className="page-header">
        <h1 className="page-title">System Health</h1>
      </header>
      <div className="card">
        <div className="card__body">
          {health ? (
            <pre style={{ fontFamily: "monospace", fontSize: "0.875rem" }}>{JSON.stringify(health, null, 2)}</pre>
          ) : <p>Loading…</p>}
        </div>
      </div>
    </DashboardLayout>
  );
};

// ─── Session Provider ─────────────────────────────────────────────────────────
// Accepts initialUser from LoginHandler's /sync response — skips /me on fresh login.
// Falls back to /me on page-refresh (when initialUser is null and cookie exists).
const SessionProvider = ({
  children,
  initialUser = null,
}: {
  children: (user: InternalUser | null, error?: string | null) => React.ReactNode;
  initialUser?: InternalUser | null;
}) => {
  const { instance } = useMsal();
  const [internalUser, setInternalUser] = useState<InternalUser | null>(initialUser);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialUser) return; // already have user from sync — skip fetch
    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then(async res => {
        if (res.status === 401) {
          // Stale or expired session cookie — clear cache and force re-login
          clearSessionCache();
          await instance.loginRedirect({ scopes: ["openid", "profile", "email"] });
          return null;
        }
        if (!res.ok) throw new Error(`Session load failed: ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (!data) return; // loginRedirect in flight
        if (data.user) setInternalUser(data.user);
        else setError("User data missing.");
      })
      .catch(err => { console.error("Session load error:", err); setError(err.message || "Failed to communicate with backend"); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Propagate re-sync
  useEffect(() => {
    if (initialUser && initialUser !== internalUser) {
      setInternalUser(initialUser);
    }
  }, [initialUser, internalUser]);

  if (error) {
    return (
      <div style={{ padding: 40, color: "var(--error-500)", textAlign: "center", fontFamily: "Inter, sans-serif" }}>
        <h3>Session Error</h3><p>{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn--primary" style={{ marginTop: 10 }}>Retry</button>
      </div>
    );
  }
  return <>{children(internalUser, error)}</>;
};

const AppContent = () => {
  // User received directly from /sync response — avoids a redundant /me fetch
  const [syncedUser, setSyncedUser] = useState<InternalUser | null>(null);

  return (
    <Routes>
      {/* ── Public routes (no auth required) ───────────────────────── */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      {/* ── Protected routes ────────────────────────────────────────── */}
      <Route
        path="/*"
        element={
          <ProtectedRoute onSyncComplete={setSyncedUser}>
            <SessionProvider initialUser={syncedUser}>
              {(internalUser) => (
                <Routes>
                  {/* /dashboard → smart redirect to role-specific dashboard */}
                  <Route path="/dashboard" element={<RootRedirect internalUser={internalUser} />} />

                  {/* Admin */}
                  <Route path="/admin-dashboard" element={<RoleGuard internalUser={internalUser} allowed={isAdminRole}><AdminDashboard internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/admin/users" element={<RoleGuard internalUser={internalUser} allowed={isAdminRole}><AdminUsersPage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/admin/settings" element={<RoleGuard internalUser={internalUser} allowed={isAdminRole}><AdminSettingsPage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/admin/performance" element={<RoleGuard internalUser={internalUser} allowed={isAdminRole}><PerformancePage internalUser={internalUser} role="Admin" /></RoleGuard>} />
                  <Route path="/admin/health" element={<RoleGuard internalUser={internalUser} allowed={isAdminRole}><AdminHealthPage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/admin/holidays" element={<RoleGuard internalUser={internalUser} allowed={isAdminRole}><HolidayCalendarPage internalUser={internalUser} /></RoleGuard>} />

                  {/* HR */}
                  <Route path="/hr/dashboard" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><HRDashboard internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/hr/employees" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><HREmployeesPage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/hr/documents" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><DocumentsPage internalUser={internalUser} isHR={true} role="HR" /></RoleGuard>} />
                  <Route path="/hr/announcements" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><AnnouncementsPage internalUser={internalUser} isHR={true} role="HR" /></RoleGuard>} />
                  <Route path="/hr/performance" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><PerformancePage internalUser={internalUser} role="HR" /></RoleGuard>} />
                  <Route path="/hr/leave-requests" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><HRLeavePage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/hr/leave-policies" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><HRLeavePoliciesPage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/hr/leave-management" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><HRLeavePage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/hr/timesheets" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><HRTimeSheetsPage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/hr/my-leave" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><EmployeeLeavePage internalUser={internalUser} role="HR" /></RoleGuard>} />
                  <Route path="/hr/my-timesheet" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><EmployeeTimesheetPage internalUser={internalUser} role="HR" /></RoleGuard>} />
                  <Route path="/hr/holidays" element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><HolidayCalendarPage internalUser={internalUser} /></RoleGuard>} />

                  {/* Manager */}
                  <Route path="/manager/dashboard" element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><ManagerDashboard internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/manager/leave-approvals" element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><ManagerApprovalsPage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/manager/employees" element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><ManagerEmployeesPage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/manager/timesheets" element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><ManagerTimesheetsPage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/manager/documents" element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><DocumentsPage internalUser={internalUser} role="Manager" /></RoleGuard>} />
                  <Route path="/manager/announcements" element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><AnnouncementsPage internalUser={internalUser} role="Manager" /></RoleGuard>} />
                  <Route path="/manager/performance" element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><PerformancePage internalUser={internalUser} role="Manager" /></RoleGuard>} />
                  <Route path="/manager/my-leave" element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><EmployeeLeavePage internalUser={internalUser} role="Manager" /></RoleGuard>} />
                  <Route path="/manager/my-timesheet" element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><EmployeeTimesheetPage internalUser={internalUser} role="Manager" /></RoleGuard>} />
                  <Route path="/manager/holidays" element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><HolidayViewPage internalUser={internalUser} role="Manager" /></RoleGuard>} />

                  {/* Employee */}
                  <Route path="/employee-dashboard" element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><EmployeeDashboard internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/employee/leave" element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><EmployeeLeavePage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/employee/timesheets" element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><EmployeeTimesheetPage internalUser={internalUser} /></RoleGuard>} />
                  <Route path="/employee/announcements" element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><AnnouncementsPage internalUser={internalUser} role={internalUser?.role} /></RoleGuard>} />
                  <Route path="/employee/documents" element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><DocumentsPage internalUser={internalUser} role={internalUser?.role} /></RoleGuard>} />
                  <Route path="/employee/performance" element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><PerformancePage internalUser={internalUser} role="Employee" /></RoleGuard>} />
                  <Route path="/employee/holidays" element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><HolidayViewPage internalUser={internalUser} role="Employee" /></RoleGuard>} />

                  {/* Shared */}
                  <Route path="/announcements/:id" element={<AnnouncementDetailPage internalUser={internalUser} />} />
                  <Route path="/access-denied" element={<AccessDenied />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              )}
            </SessionProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
};

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  </ErrorBoundary>
);

export default App;
