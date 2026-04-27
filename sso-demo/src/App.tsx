import { useMsal } from "@azure/msal-react";
import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ManagerDashboard } from "./components/ManagerDashboard";
import { HRDashboard } from "./components/HRDashboard";
import { EmployeeDashboard } from "./components/EmployeeDashboard";
import { AccessDenied } from "./components/AccessDenied";
import { DashboardLayout } from "./components/DashboardLayout";
import { 
  Shield, 
  Activity, 
  Server, 
  Users, 
  Settings, 
  Lock,
  ArrowRight,
  Database,
  Globe,
  PieChart,
  HardDrive
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────
interface InternalUser {
  id?: number;
  entra_oid?: string;
  name?: string;
  email?: string;
  job_title?: string;
  department?: string;
  app_roles?: string[];
  is_active?: boolean;
}

// ─── Role-based redirect helper ──────────────────────────────────
function getRedirectPath(roles: string[]): string {
  if (roles.includes("Admin") || roles.includes("SipraHub-SystemAdmin")) {
    return "/admin-dashboard";
  }
  if (roles.includes("HR") || roles.includes("SipraHub-HR")) {
    return "/hr-dashboard";
  }
  if (roles.includes("Manager") || roles.includes("SipraHub-Manager")) {
    return "/manager-dashboard";
  }
  if (
    roles.includes("Employee") ||
    roles.includes("SipraHub-Employee") ||
    roles.includes("Default Access")
  ) {
    return "/employee-dashboard";
  }
  return "/access-denied";
}

// ─── Role guard HOC ──────────────────────────────────────────────
function RoleGuard({
  children,
  allowed,
  internalUser,
}: {
  children: React.ReactNode;
  allowed: (roles: string[]) => boolean;
  internalUser: InternalUser | null;
}) {
  if (!internalUser) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
        <p style={{ color: "var(--neutral-500)", fontFamily: "Inter, sans-serif" }}>
          Loading session…
        </p>
      </div>
    );
  }

  const roles = internalUser.app_roles || [];
  const isAdmin = roles.includes("Admin") || roles.includes("SipraHub-SystemAdmin");

  if (isAdmin || allowed(roles)) {
    return <>{children}</>;
  }

  return <Navigate to="/access-denied" replace />;
}

// ─── Root redirect ───────────────────────────────────────────────
function RootRedirect({ internalUser }: { internalUser: InternalUser | null }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!internalUser) return;
    const roles = internalUser.app_roles || [];
    navigate(getRedirectPath(roles), { replace: true });
  }, [internalUser, navigate]);

  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <p style={{ color: "var(--neutral-500)", fontFamily: "Inter, sans-serif" }}>
        Redirecting to your dashboard…
      </p>
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────
const AdminDashboard = ({ internalUser }: { internalUser: InternalUser | null }) => {
  const navigate = useNavigate();
  
  const stats = [
    { label: "Active Users", value: "1,248", trend: "Normal", icon: <Users size={20} />, color: "#3B82F6" },
    { label: "System Load", value: "14.2%", trend: "Optimal", icon: <Server size={20} />, color: "#10B981" },
    { label: "Sync Status", value: "Active", trend: "1 min ago", icon: <Activity size={20} />, color: "#F59E0B" },
    { label: "Security Health", value: "Secure", trend: "Verified", icon: <Shield size={20} />, color: "#CE2124" },
  ];

  return (
    <DashboardLayout internalUser={internalUser} role="Admin">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Home</span>
          <span className="breadcrumb__separator">/</span>
          <span>Admin Dashboard</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title">Systems Control</h1>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
             <button className="btn btn--secondary">
                <Settings size={16} />
                Global Config
             </button>
             <button className="btn btn--primary">
                <Lock size={16} />
                Security Audit
             </button>
          </div>
        </div>
      </header>

      <section className="stats-grid">
        {stats.map((stat, idx) => (
          <div className="stat-card" key={idx}>
            <div className="stat-card__header">
              <div className="stat-card__icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
                {stat.icon}
              </div>
              <span className="stat-card__trend" style={{ color: stat.color === '#CE2124' ? 'var(--error-700)' : stat.color }}>
                {stat.trend}
              </span>
            </div>
            <div>
              <div className="stat-card__label">{stat.label}</div>
              <div className="stat-card__value">{stat.value}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="content-grid">
        <div className="card" style={{ gridColumn: 'span 8' }}>
          <div className="card__header">
            <h3 className="card__title">Operational Health</h3>
            <button className="btn btn--ghost btn--sm">Full Report</button>
          </div>
          <div className="card__body">
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-6)' }}>
                <div style={{ padding: 'var(--space-5)', background: 'var(--neutral-50)', borderRadius: 'var(--rounded-xl)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                      <Globe size={18} className="text-primary-500" style={{ color: 'var(--primary-500)' }} />
                      <span style={{ fontWeight: 600 }}>SSO Connectivity</span>
                   </div>
                   <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-1)' }}>99.98%</div>
                   <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Last 30 days uptime</div>
                </div>
                <div style={{ padding: 'var(--space-5)', background: 'var(--neutral-50)', borderRadius: 'var(--rounded-xl)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                      <Database size={18} style={{ color: 'var(--success-500)' }} />
                      <span style={{ fontWeight: 600 }}>Database Performance</span>
                   </div>
                   <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-1)' }}>24ms</div>
                   <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Avg query response time</div>
                </div>
                <div style={{ padding: 'var(--space-5)', background: 'var(--neutral-50)', borderRadius: 'var(--rounded-xl)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                      <HardDrive size={18} style={{ color: 'var(--dept-finance)' }} />
                      <span style={{ fontWeight: 600 }}>Storage Usage</span>
                   </div>
                   <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-1)' }}>42%</div>
                   <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>1.2TB of 3.0TB used</div>
                </div>
                <div style={{ padding: 'var(--space-5)', background: 'var(--neutral-50)', borderRadius: 'var(--rounded-xl)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                      <PieChart size={18} style={{ color: 'var(--dept-it)' }} />
                      <span style={{ fontWeight: 600 }}>API Traffic</span>
                   </div>
                   <div style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--space-1)' }}>+12%</div>
                   <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Increase since last week</div>
                </div>
             </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 4' }}>
          <div className="card__header">
            <h3 className="card__title">Module Management</h3>
          </div>
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              { label: "HR Dashboard", path: "/hr-dashboard", color: "var(--primary-500)" },
              { label: "Manager Dashboard", path: "/manager-dashboard", color: "var(--dept-it)" },
              { label: "Employee View", path: "/employee-dashboard", color: "var(--dept-finance)" },
            ].map((dash, idx) => (
              <button key={idx} onClick={() => navigate(dash.path)} className="btn btn--secondary" style={{ justifyContent: 'space-between', padding: 'var(--space-4)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: dash.color }}></span>
                  {dash.label}
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          <div className="card__footer">
             <p style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Admins have bypass access to all dashboard routes for maintenance.</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

// ─── Session loader wrapper ───────────────────────────────────────
const SessionProvider = ({
  children,
}: {
  children: (user: InternalUser | null, error: string | null) => React.ReactNode;
}) => {
  const [internalUser, setInternalUser] = useState<InternalUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:3000/api/auth/me", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Session load failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.user) setInternalUser(data.user);
        else setError("User data missing from session response.");
      })
      .catch((err) => {
        console.error("Session load error:", err);
        setError(err.message || "Failed to communicate with backend");
      });
  }, []);

  if (error) {
    return (
      <div style={{ padding: 40, color: "var(--error-500)", textAlign: "center", fontFamily: "Inter, sans-serif" }}>
        <h3>Session Error</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()} className="btn btn--primary" style={{ marginTop: 10 }}>
          Retry
        </button>
      </div>
    );
  }

  return <>{children(internalUser, error)}</>;
};

// ─── Legacy Test Pages (Updated for new Layout) ──────────────────
const LegacyCheckPage = ({ type, internalUser }: { type: "admin" | "hr" | "employee" | "manager", internalUser: any }) => {
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const navigate = useNavigate();

  const endpointMap: Record<string, string> = {
    admin: "/api/admin-check",
    hr: "/api/hr-check",
    employee: "/api/employee-check",
    manager: "/api/manager-check",
  };

  useEffect(() => {
    fetch(`http://localhost:3000${endpointMap[type]}`, { credentials: "include" })
      .then((res) => {
        if (res.status === 403 || res.status === 401) { setApiResponse("Access Denied"); return null; }
        return res.json();
      })
      .then((data) => { if (data?.message) setApiResponse(data.message); })
      .catch(console.error);
  }, [type]);

  const roleLabelMap: Record<string, "Admin" | "HR" | "Manager" | "Employee"> = {
    admin: "Admin",
    hr: "HR",
    employee: "Employee",
    manager: "Manager"
  };

  return (
    <DashboardLayout internalUser={internalUser} role={roleLabelMap[type]}>
       <header className="page-header">
        <h1 className="page-title">{type.toUpperCase()} Role Check</h1>
      </header>
      <div className="card">
        <div className="card__header">
           <h3 className="card__title">Backend API Response</h3>
        </div>
        <div className="card__body">
           {apiResponse ? (
            <p style={{ color: apiResponse.includes("Denied") ? "var(--error-500)" : "var(--success-500)", fontWeight: "bold", fontSize: '1.125rem' }}>
              {apiResponse}
            </p>
          ) : (
            <p>Loading…</p>
          )}
        </div>
        <div className="card__footer">
           <button onClick={() => navigate("/")} className="btn btn--secondary">Back to Home</button>
        </div>
      </div>
    </DashboardLayout>
  );
};

// ─── Main App ─────────────────────────────────────────────────────
const AppContent = () => {
  return (
    <ProtectedRoute>
      <SessionProvider>
        {(internalUser) => (
          <Routes>
            <Route path="/" element={<RootRedirect internalUser={internalUser} />} />

            <Route
              path="/admin-dashboard"
              element={
                <RoleGuard
                  internalUser={internalUser}
                  allowed={(r) => r.includes("Admin") || r.includes("SipraHub-SystemAdmin")}
                >
                  <AdminDashboard internalUser={internalUser} />
                </RoleGuard>
              }
            />

            <Route
              path="/hr-dashboard"
              element={
                <RoleGuard
                  internalUser={internalUser}
                  allowed={(r) => r.includes("HR") || r.includes("SipraHub-HR")}
                >
                  <HRDashboard internalUser={internalUser!} />
                </RoleGuard>
              }
            />

            <Route
              path="/manager-dashboard"
              element={
                <RoleGuard
                  internalUser={internalUser}
                  allowed={(r) => r.includes("Manager") || r.includes("SipraHub-Manager")}
                >
                  <ManagerDashboard internalUser={internalUser!} />
                </RoleGuard>
              }
            />

            <Route
              path="/employee-dashboard"
              element={
                <RoleGuard
                  internalUser={internalUser}
                  allowed={(r) =>
                    r.includes("Employee") ||
                    r.includes("SipraHub-Employee") ||
                    r.includes("Default Access")
                  }
                >
                  <EmployeeDashboard internalUser={internalUser!} />
                </RoleGuard>
              }
            />

            <Route path="/access-denied" element={<AccessDenied />} />

            {/* Legacy Check Pages */}
            <Route path="/admin-check"    element={<LegacyCheckPage type="admin" internalUser={internalUser} />} />
            <Route path="/hr-page"        element={<LegacyCheckPage type="hr" internalUser={internalUser} />} />
            <Route path="/employee-page"  element={<LegacyCheckPage type="employee" internalUser={internalUser} />} />
            <Route path="/manager-page"   element={<LegacyCheckPage type="manager" internalUser={internalUser} />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </SessionProvider>
    </ProtectedRoute>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
