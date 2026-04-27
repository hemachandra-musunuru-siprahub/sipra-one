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
  PieChart
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
    fetch("http://localhost:3000/api/auth/logout", {
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
        { label: "System Health", icon: <Shield />, path: "#" },
      ]},
      { label: "Management", items: [
        { label: "HR Dashboard", icon: <Users />, path: "/hr-dashboard" },
        { label: "Manager Dashboard", icon: <Briefcase />, path: "/manager-dashboard" },
        { label: "Employee View", icon: <UserCheck />, path: "/employee-dashboard" },
      ]},
      { label: "Technical", items: [
        { label: "App Roles", icon: <Settings />, path: "#" },
        { label: "Audit Logs", icon: <FileText />, path: "#" },
      ]}
    ],
    HR: [
      { label: "Overview", items: [
        { label: "Dashboard", icon: <LayoutDashboard />, path: "/hr-dashboard" },
      ]},
      { label: "People", items: [
        { label: "Employees", icon: <Users />, path: "#" },
        { label: "Leave Requests", icon: <Calendar />, path: "#" },
        { label: "Recruitment", icon: <Search />, path: "#" },
      ]},
      { label: "Organization", items: [
        { label: "Documents", icon: <FileText />, path: "#" },
        { label: "Analytics", icon: <PieChart />, path: "#" },
      ]}
    ],
    Manager: [
      { label: "Overview", items: [
        { label: "Dashboard", icon: <LayoutDashboard />, path: "/manager-dashboard" },
      ]},
      { label: "My Team", items: [
        { label: "Approvals", icon: <UserCheck />, path: "#" },
        { label: "Timesheets", icon: <Calendar />, path: "#" },
        { label: "Performance", icon: <PieChart />, path: "#" },
      ]},
      { label: "Resources", items: [
        { label: "Team Docs", icon: <FileText />, path: "#" },
        { label: "Reports", icon: <FileText />, path: "#" },
      ]}
    ],
    Employee: [
      { label: "Overview", items: [
        { label: "Dashboard", icon: <LayoutDashboard />, path: "/employee-dashboard" },
      ]},
      { label: "Self Service", items: [
        { label: "My Profile", icon: <Users />, path: "#" },
        { label: "Leave Request", icon: <Calendar />, path: "#" },
        { label: "Timesheets", icon: <Calendar />, path: "#" },
      ]},
      { label: "Company", items: [
        { label: "Announcements", icon: <Megaphone />, path: "#" },
        { label: "Documents", icon: <FileText />, path: "#" },
        { label: "Support", icon: <HelpCircle />, path: "#" },
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
