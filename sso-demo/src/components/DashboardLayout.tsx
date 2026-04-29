import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Calendar, 
  Bell, 
  Search, 
  LogOut, 
  Menu,
  Shield,
  Briefcase,
  UserCheck,
  HelpCircle,
  Megaphone,
  Settings,
  PieChart,
  Target
} from "lucide-react";
import { useMsal } from "@azure/msal-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
  internalUser: any;
  role: "Admin" | "HR" | "Manager" | "Employee";
}

export const DashboardLayout = ({ children, internalUser, role }: DashboardLayoutProps) => {
  const { instance, accounts } = useMsal();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
    fetch(`${API}/api/auth/logout`, {
      method: "POST",
      credentials: "include"
    }).finally(() => {
      instance.logoutRedirect({
        postLogoutRedirectUri: "/",
      }).catch((e) => {
        console.error(e);
      });
    });
  };

  const userName = internalUser?.name || accounts[0]?.name || "User";
  const initials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const navGroups = {
    Admin: [
      { label: "Overview", items: [
        { label: "Dashboard", icon: <LayoutDashboard />, path: "/admin-dashboard" },
        { label: "System Health", icon: <Shield />, path: "/admin/health" },
      ]},
      { label: "Management", items: [
        { label: "User Management", icon: <Users />, path: "/admin/users" },
      ]},
      { label: "Technical", items: [
        { label: "Audit Logs", icon: <FileText />, path: "/admin/audit" },
      ]}
    ],
    HR: [
      { label: "Overview", items: [
        { label: "Dashboard", icon: <LayoutDashboard />, path: "/hr-dashboard" },
      ]},
      { label: "People", items: [
        { label: "Employees", icon: <Users />, path: "/hr/employees" },
        { label: "Leave Requests", icon: <Calendar />, path: "/hr/leave" },
        { label: "Performance", icon: <Target />, path: "/hr/performance" },
      ]},
      { label: "Content", items: [
        { label: "Documents", icon: <FileText />, path: "/hr/documents" },
        { label: "Announcements", icon: <Megaphone />, path: "/hr/announcements" },
      ]}
    ],
    Manager: [
      { label: "Overview", items: [
        { label: "Dashboard", icon: <LayoutDashboard />, path: "/manager-dashboard" },
      ]},
      { label: "My Team", items: [
        { label: "Leave Approvals", icon: <UserCheck />, path: "/manager/approvals" },
        { label: "Timesheets", icon: <Calendar />, path: "/manager/timesheets" },
        { label: "Performance", icon: <Target />, path: "/manager/performance" },
      ]},
      { label: "Resources", items: [
        { label: "Announcements", icon: <Megaphone />, path: "/manager/announcements" },
        { label: "Team Docs", icon: <FileText />, path: "/manager/documents" },
      ]}
    ],
    Employee: [
      { label: "Overview", items: [
        { label: "Dashboard", icon: <LayoutDashboard />, path: "/employee-dashboard" },
      ]},
      { label: "Self Service", items: [
        { label: "Leave Request", icon: <Calendar />, path: "/employee/leave" },
        { label: "Timesheets", icon: <Calendar />, path: "/employee/timesheets" },
        { label: "Performance", icon: <Target />, path: "/employee/performance" },
      ]},
      { label: "Company", items: [
        { label: "Announcements", icon: <Megaphone />, path: "/employee/announcements" },
        { label: "Documents", icon: <FileText />, path: "/employee/documents" },
      ]}
    ]
  };


  const currentGroups = navGroups[role] || navGroups.Employee;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar__header">
          <Link to="/" className="sidebar__logo">
            <span>SipraHub</span>
          </Link>
        </div>
        <div className="sidebar__content">
          {currentGroups.map((group, idx) => (
            <div className="nav-group" key={idx}>
              <div className="nav-group__label">{group.label}</div>
              {group.items.map((item, i) => (
                <Link 
                  key={i} 
                  to={item.path} 
                  className={`nav-item ${location.pathname === item.path ? 'nav-item--active' : ''}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}
          
          <div className="nav-group" style={{ marginTop: 'auto' }}>
             <button onClick={handleLogout} className="nav-item" style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <LogOut />
                <span>Sign Out</span>
             </button>
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header className="topbar">
        <div className="topbar__search">
          <Search size={18} />
          <input type="text" placeholder="Search intranet..." className="topbar__search-input" />
        </div>
        <div className="topbar__actions">
          <button className="topbar__icon-btn">
            <Bell size={20} />
          </button>
          <div className="user-profile">
            <div className="user-profile__info">
              <span className="user-profile__name">{userName}</span>
              <span className="user-profile__role">{role}</span>
            </div>
            <div className="avatar avatar--online">
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};
