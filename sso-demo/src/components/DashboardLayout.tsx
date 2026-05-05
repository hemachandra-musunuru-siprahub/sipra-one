import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Search,
  LogOut,
  Shield,
  Briefcase,
  UserCheck,
  Megaphone,
  Building2,
  ClipboardList,
  Target
} from "lucide-react";
import { useMsal } from "@azure/msal-react";
import { useGlobalSearch } from "../hooks/useGlobalSearch";
import { SearchDropdown } from "./SearchDropdown";
import { NotificationBell } from "./NotificationBell";
import { useNotifications } from "../hooks/useNotifications";
import { useState, useRef, useEffect } from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  internalUser: any;
  role: "Admin" | "HR" | "Manager" | "Employee";
}

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const ROLE_COLOR: Record<string, string> = {
  Admin: "var(--primary-500)",
  HR: "var(--dept-hr)",
  Manager: "var(--dept-it)",
  Employee: "var(--dept-finance)",
};

export const DashboardLayout = ({ children, internalUser, role }: DashboardLayoutProps) => {
  const { instance, accounts } = useMsal();
  const location = useLocation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();

  // ── Global Search State ──
  const [searchQuery, setSearchQuery] = useState("");
  const { results, isLoading: searchLoading } = useGlobalSearch(searchQuery);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Notifications ──
  const userOid = internalUser?.entra_oid ?? internalUser?.oid ?? null;
  const { notifications, unreadCount, isLoading: notifLoading, markRead, markAllRead } = useNotifications({ userOid });

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
    fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" }).finally(() => {
      instance.logoutRedirect({ postLogoutRedirectUri: "/" }).catch(console.error);
    });
  };

  const currentRole = role || "Employee";
  const basePath = currentRole === "Admin" ? "/admin" : currentRole === "HR" ? "/hr" : currentRole === "Manager" ? "/manager" : "/employee";
  const dashboardPath = currentRole === "Admin" ? "/admin-dashboard" : currentRole === "HR" ? "/hr-dashboard" : currentRole === "Manager" ? "/manager/dashboard" : "/employee-dashboard";

  const userName = internalUser?.name || accounts[0]?.name || "User";
  const userEmail = internalUser?.email || accounts[0]?.username || "";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navGroups: Record<string, NavGroup[]> = {
    Admin: [
      {
        label: "OVERVIEW",
        items: [
          { label: "Dashboard", icon: <LayoutDashboard size={20} />, path: dashboardPath },
          { label: "System Health", icon: <Shield size={20} />, path: `${basePath}/health` },
        ],
      },
      {
        label: "MANAGEMENT",
        items: [
          { label: "Users", icon: <Users size={20} />, path: "/admin/users" },
        ],
      },
    ],
    HR: [
      {
        label: "Overview",
        items: [
          { label: "Dashboard", icon: <LayoutDashboard size={20} />, path: dashboardPath },
        ],
      },
      {
        label: "People",
        items: [
          { label: "Employees", icon: <Users size={20} />, path: `${basePath}/employees` },
          { label: "Leave Requests", icon: <Calendar size={20} />, path: `${basePath}/leave-requests` },
          { label: "Leave Policies", icon: <ClipboardList size={20} />, path: `${basePath}/leave-policies` },
          { label: "Timesheets", icon: <Briefcase size={20} />, path: `${basePath}/timesheets` },
          { label: "Performance", icon: <Target size={20} />, path: `${basePath}/performance` },
        ],
      },
      {
        label: "Content",
        items: [
          { label: "Documents", icon: <FileText size={20} />, path: `${basePath}/documents` },
          { label: "Announcements", icon: <Megaphone size={20} />, path: `${basePath}/announcements` },
        ],
      },
      {
        label: "Self Service",
        items: [
          { label: "My Leave", icon: <Calendar size={20} />, path: `${basePath}/my-leave` },
        ],
      },
    ],
    Manager: [
      {
        label: "Overview",
        items: [
          { label: "Dashboard", icon: <LayoutDashboard size={20} />, path: dashboardPath },
        ],
      },
      {
        label: "My Team",
        items: [
          { label: "Leave Approvals", icon: <UserCheck size={20} />, path: "/manager/leave-approvals" },
          { label: "Timesheets", icon: <ClipboardList size={20} />, path: "/manager/timesheets" },
          { label: "Performance", icon: <Target size={20} />, path: "/manager/performance" },
        ],
      },
      {
        label: "Resources",
        items: [
          { label: "Announcements", icon: <Megaphone size={20} />, path: `${basePath}/announcements` },
          { label: "Documents", icon: <FileText size={20} />, path: `${basePath}/documents` },
        ],
      },
      {
        label: "Self Service",
        items: [
          { label: "My Leave", icon: <Calendar size={20} />, path: "/manager/my-leave" },
        ],
      },
    ],
    Employee: [
      {
        label: "Overview",
        items: [
          { label: "Dashboard", icon: <LayoutDashboard size={20} />, path: dashboardPath },
        ],
      },
      {
        label: "Self Service",
        items: [
          { label: "My Leave", icon: <Calendar size={20} />, path: `${basePath}/leave` },
          { label: "Timesheets", icon: <ClipboardList size={20} />, path: `${basePath}/timesheets` },
          { label: "Performance", icon: <Target size={20} />, path: `${basePath}/performance` },
        ],
      },
      {
        label: "Company",
        items: [
          { label: "Announcements", icon: <Megaphone size={20} />, path: `${basePath}/announcements` },
          { label: "Documents", icon: <FileText size={20} />, path: `${basePath}/documents` },
        ],
      },
    ],
  };

  const currentGroups = navGroups[currentRole] || navGroups.Employee;
  const roleAccent = ROLE_COLOR[currentRole] || "var(--primary-500)";

  return (
    <div className="app-container">
      {/* ── Sidebar ── */}
      <aside className="sidebar">

        {/* Logo / Brand */}
        <div className="sidebar__brand">
          <Link to="/" className="sidebar__logo-link">
            <div className="sidebar__logo-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect width="22" height="22" rx="6" fill="var(--primary-500)" />
                <path d="M5 11h12M11 5v12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <span className="sidebar__logo-text">SipraHub</span>
          </Link>
        </div>



        {/* Nav */}
        <nav className="sidebar__nav">
          {currentGroups.map((group, gi) => (
            <div className="sidebar__group" key={gi}>
              <span className="sidebar__group-label">{group.label}</span>
              {group.items.map((item, ii) => {
                const isActive = item.path.includes("?")
                  ? (location.pathname + location.search) === item.path
                  : location.pathname === item.path;
                return (
                  <Link
                    key={ii}
                    to={item.path}
                    className={`sidebar__nav-item${isActive ? " sidebar__nav-item--active" : ""}`}
                    title={item.label}
                  >
                    <span className="sidebar__nav-icon">{item.icon}</span>
                    <span className="sidebar__nav-label">{item.label}</span>
                    {isActive && <span className="sidebar__nav-indicator" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer / Logout */}
        <div className="sidebar__footer">
          <button onClick={handleLogout} className="sidebar__logout-btn" title="Sign out">
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Topbar ── */}
      <header className="topbar">
        <div ref={searchRef} className="topbar__search relative">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search SipraHub…"
            className="topbar__search-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchVisible(true);
            }}
            onFocus={() => setIsSearchVisible(true)}
          />
          <SearchDropdown
            results={results}
            isLoading={searchLoading}
            isVisible={isSearchVisible && searchQuery.length >= 2}
            onClose={() => setIsSearchVisible(false)}
          />
        </div>
        <div className="topbar__actions">
          <NotificationBell
            notifications={notifications}
            unreadCount={unreadCount}
            isLoading={notifLoading}
            role={role}
            onMarkRead={markRead}
            onMarkAllRead={markAllRead}
          />

          <div className="topbar__user">
            <div className="topbar__user-text">
              <span className="topbar__user-name">{userName}</span>
              <span className="topbar__user-email">{userEmail}</span>
            </div>
            <div className="topbar__avatar" style={{ background: roleAccent }}>
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main-content">{children}</main>
    </div>
  );
};
