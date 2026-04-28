import { useMsal } from "@azure/msal-react";
import { useState, useEffect } from "react";
import {
  BrowserRouter, Routes, Route, Navigate, useNavigate,
} from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ManagerDashboard } from "./components/ManagerDashboard";
import { HRDashboard } from "./components/HRDashboard";
import { EmployeeDashboard } from "./components/EmployeeDashboard";
import { AccessDenied } from "./components/AccessDenied";
import { DashboardLayout } from "./components/DashboardLayout";
import {
  Shield, Activity, Server, Users, Settings, Lock,
  ArrowRight, Database, Globe, PieChart, HardDrive
} from "lucide-react";

// Pages
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { EmployeeLeavePage } from "./pages/employee/EmployeeLeavePage";
import { EmployeeTimesheetPage } from "./pages/employee/EmployeeTimesheetPage";
import { AnnouncementsPage } from "./pages/shared/AnnouncementsPage";
import { DocumentsPage } from "./pages/shared/DocumentsPage";
import { ManagerApprovalsPage } from "./pages/manager/ManagerApprovalsPage";
import { ManagerTimesheetsPage } from "./pages/manager/ManagerTimesheetsPage";
import { HREmployeesPage } from "./pages/hr/HREmployeesPage";
import { HRLeavePage } from "./pages/hr/HRLeavePage";

// ─── API base (use env var everywhere) ───────────────────────────────────────
const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

// ─── Types ────────────────────────────────────────────────────────────────────
interface InternalUser {
  id?: number;
  entra_oid?: string;
  name?: string;
  email?: string;
  roles?: string[];
  is_active?: boolean;
  manager_entra_oid?: string;
}

// ─── Role helpers ─────────────────────────────────────────────────────────────
const isAdminRole   = (r: string[]) => r.includes("Admin") || r.includes("SipraHub-SystemAdmin");
const isHRRole      = (r: string[]) => r.includes("HR") || r.includes("SipraHub-HR");
const isManagerRole = (r: string[]) => r.includes("Manager") || r.includes("SipraHub-Manager");
const isEmployeeRole= (r: string[]) => r.includes("Employee") || r.includes("SipraHub-Employee") || r.includes("Default Access") || isAdminRole(r) || isHRRole(r) || isManagerRole(r);

function getRedirectPath(roles: string[]): string {
  if (isAdminRole(roles))    return "/admin-dashboard";
  if (isHRRole(roles))       return "/hr-dashboard";
  if (isManagerRole(roles))  return "/manager-dashboard";
  if (isEmployeeRole(roles)) return "/employee-dashboard";
  return "/access-denied";
}

// ─── Role Guard ───────────────────────────────────────────────────────────────
function RoleGuard({ children, allowed, internalUser }: {
  children: React.ReactNode;
  allowed: (roles: string[]) => boolean;
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
  const roles = internalUser.roles || [];
  if (isAdminRole(roles) || allowed(roles)) return <>{children}</>;
  return <Navigate to="/access-denied" replace />;
}

// ─── Root redirect ────────────────────────────────────────────────────────────
function RootRedirect({ internalUser }: { internalUser: InternalUser | null }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!internalUser) return;
    navigate(getRedirectPath(internalUser.roles || []), { replace: true });
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
  const [userCount, setUserCount] = useState<number | null>(null);
  const [dbStatus, setDbStatus] = useState<string>("Checking…");

  useEffect(() => {
    fetch(`${API}/health`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setDbStatus(d.db === "connected" ? "Connected" : "Error"))
      .catch(() => setDbStatus("Error"));
    fetch(`${API}/api/users`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUserCount(d.users?.filter((u: any) => u.is_active).length ?? null))
      .catch(() => {});
  }, []);

  const stats = [
    { label: "Active Users",    value: userCount !== null ? String(userCount) : "…", trend: "From DB",   icon: <Users size={20} />,    color: "#3B82F6" },
    { label: "Database",        value: dbStatus,                                      trend: "Health",    icon: <Server size={20} />,   color: "#10B981" },
    { label: "Sync Status",     value: "Active",                                      trend: "1 min ago", icon: <Activity size={20} />, color: "#F59E0B" },
    { label: "Security Health", value: "Secure",                                      trend: "Verified",  icon: <Shield size={20} />,   color: "#CE2124" },
  ];

  return (
    <DashboardLayout internalUser={internalUser} role="Admin">
      <header className="page-header">
        <div className="breadcrumb"><span>Home</span><span className="breadcrumb__separator">/</span><span>Admin Dashboard</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Systems Control</h1>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--secondary"><Settings size={16} /> Global Config</button>
            <button className="btn btn--primary"><Lock size={16} /> Security Audit</button>
          </div>
        </div>
      </header>

      <section className="stats-grid">
        {stats.map((stat, idx) => (
          <div className="stat-card" key={idx}>
            <div className="stat-card__header">
              <div className="stat-card__icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>{stat.icon}</div>
              <span className="stat-card__trend" style={{ color: stat.color }}>{stat.trend}</span>
            </div>
            <div><div className="stat-card__label">{stat.label}</div><div className="stat-card__value">{stat.value}</div></div>
          </div>
        ))}
      </section>

      <div className="content-grid">
        <div className="card" style={{ gridColumn: "span 8" }}>
          <div className="card__header"><h3 className="card__title">Operational Health</h3><button className="btn btn--ghost btn--sm">Full Report</button></div>
          <div className="card__body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-6)" }}>
              {[
                { icon: <Globe size={18} style={{ color: "var(--primary-500)" }} />, label: "SSO Connectivity", value: "99.98%", sub: "Last 30 days uptime" },
                { icon: <Database size={18} style={{ color: "var(--success-500)" }} />, label: "Database Performance", value: "24ms", sub: "Avg query response time" },
                { icon: <HardDrive size={18} style={{ color: "var(--dept-finance)" }} />, label: "Storage Usage", value: "42%", sub: "1.2TB of 3.0TB used" },
                { icon: <PieChart size={18} style={{ color: "var(--dept-it)" }} />, label: "API Traffic", value: "+12%", sub: "Increase since last week" },
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
        </div>

        <div className="card" style={{ gridColumn: "span 4" }}>
          <div className="card__header"><h3 className="card__title">Module Management</h3></div>
          <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {[
              { label: "User Management",    path: "/admin/users",       color: "var(--primary-500)" },
              { label: "HR Dashboard",        path: "/hr-dashboard",      color: "var(--dept-hr)" },
              { label: "Manager Dashboard",   path: "/manager-dashboard", color: "var(--dept-it)" },
              { label: "Employee View",       path: "/employee-dashboard",color: "var(--dept-finance)" },
            ].map((dash, idx) => (
              <button key={idx} onClick={() => navigate(dash.path)} className="btn btn--secondary" style={{ justifyContent: "space-between", padding: "var(--space-4)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: dash.color }} />
                  {dash.label}
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <div className="card__footer">
            <p style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>Admins have bypass access to all dashboard routes.</p>
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
    <DashboardLayout internalUser={internalUser} role="Admin">
      <header className="page-header">
        <div className="breadcrumb"><span>Admin</span><span className="breadcrumb__separator">/</span><span>System Health</span></div>
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
const SessionProvider = ({ children }: { children: (user: InternalUser | null, error: string | null) => React.ReactNode }) => {
  const [internalUser, setInternalUser] = useState<InternalUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: "include" })
      .then(async res => {
        if (!res.ok) throw new Error(`Session load failed: ${res.status}`);
        return res.json();
      })
      .then(data => { if (data.user) setInternalUser(data.user); else setError("User data missing."); })
      .catch(err => { console.error("Session load error:", err); setError(err.message || "Failed to communicate with backend"); });
  }, []);

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

// ─── Main App ─────────────────────────────────────────────────────────────────
const AppContent = () => (
  <ProtectedRoute>
    <SessionProvider>
      {(internalUser) => (
        <Routes>
          {/* Root redirect */}
          <Route path="/" element={<RootRedirect internalUser={internalUser} />} />

          {/* Admin */}
          <Route path="/admin-dashboard" element={<RoleGuard internalUser={internalUser} allowed={isAdminRole}><AdminDashboard internalUser={internalUser} /></RoleGuard>} />
          <Route path="/admin/users"     element={<RoleGuard internalUser={internalUser} allowed={isAdminRole}><AdminUsersPage internalUser={internalUser} /></RoleGuard>} />
          <Route path="/admin/health"    element={<RoleGuard internalUser={internalUser} allowed={isAdminRole}><AdminHealthPage internalUser={internalUser} /></RoleGuard>} />

          {/* HR */}
          <Route path="/hr-dashboard"      element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><HRDashboard internalUser={internalUser} /></RoleGuard>} />
          <Route path="/hr/employees"      element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><HREmployeesPage internalUser={internalUser} /></RoleGuard>} />
          <Route path="/hr/documents"      element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><DocumentsPage internalUser={internalUser} isHR={true} /></RoleGuard>} />
          <Route path="/hr/announcements"  element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><AnnouncementsPage internalUser={internalUser} isHR={true} /></RoleGuard>} />
          <Route path="/hr/leave"          element={<RoleGuard internalUser={internalUser} allowed={isHRRole}><HRLeavePage internalUser={internalUser} /></RoleGuard>} />

          {/* Manager */}
          <Route path="/manager-dashboard"   element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><ManagerDashboard internalUser={internalUser} /></RoleGuard>} />
          <Route path="/manager/approvals"   element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><ManagerApprovalsPage internalUser={internalUser} /></RoleGuard>} />
          <Route path="/manager/timesheets"  element={<RoleGuard internalUser={internalUser} allowed={isManagerRole}><ManagerTimesheetsPage internalUser={internalUser} /></RoleGuard>} />

          {/* Employee */}
          <Route path="/employee-dashboard"    element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><EmployeeDashboard internalUser={internalUser} /></RoleGuard>} />
          <Route path="/employee/leave"         element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><EmployeeLeavePage internalUser={internalUser} /></RoleGuard>} />
          <Route path="/employee/timesheets"    element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><EmployeeTimesheetPage internalUser={internalUser} /></RoleGuard>} />
          <Route path="/employee/announcements" element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><AnnouncementsPage internalUser={internalUser} /></RoleGuard>} />
          <Route path="/employee/documents"     element={<RoleGuard internalUser={internalUser} allowed={isEmployeeRole}><DocumentsPage internalUser={internalUser} /></RoleGuard>} />

          {/* Shared */}
          <Route path="/access-denied" element={<AccessDenied />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </SessionProvider>
  </ProtectedRoute>
);

const App = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
);

export default App;
