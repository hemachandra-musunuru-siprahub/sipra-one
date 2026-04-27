import React from "react";
import { DashboardLayout } from "./DashboardLayout";
import { 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  Megaphone, 
  HelpCircle, 
  CreditCard,
  CheckCircle,
  AlertCircle
} from "lucide-react";

interface Props {
  internalUser: any;
}

export const EmployeeDashboard = ({ internalUser }: Props) => {
  const stats = [
    { label: "Annual Leave", value: "18 Days", trend: "Remaining", icon: <Calendar size={20} />, color: "#CE2124" },
    { label: "Timesheet Status", value: "Submitted", trend: "Current Week", icon: <Clock size={20} />, color: "#3B82F6" },
    { label: "Pending Tasks", value: "4 Items", trend: "Requires Action", icon: <AlertCircle size={20} />, color: "#F59E0B" },
    { label: "Performance Score", value: "92%", trend: "Year to Date", icon: <CheckCircle size={20} />, color: "#10B981" },
  ];

  const modules = [
    { id: "profile", title: "My Profile", desc: "Manage personal data & contacts", icon: <User /> },
    { id: "leave", title: "My Leave", desc: "Request & track absence", icon: <Calendar /> },
    { id: "timesheets", title: "My Timesheets", desc: "Log and submit working hours", icon: <Clock /> },
    { id: "docs", title: "My Documents", desc: "Access payslips & contracts", icon: <FileText /> },
    { id: "news", title: "Company News", desc: "Latest internal announcements", icon: <Megaphone /> },
    { id: "support", title: "Help & Support", desc: "IT & HR service desk", icon: <HelpCircle /> },
    { id: "payslips", title: "Payslip Access", desc: "Secure financial statements", icon: <CreditCard /> },
  ];

  return (
    <DashboardLayout internalUser={internalUser} role="Employee">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Home</span>
          <span className="breadcrumb__separator">/</span>
          <span>Employee Dashboard</span>
        </div>
        <h1 className="page-title">Personal Dashboard</h1>
      </header>

      <section className="welcome-card">
        <div className="welcome-card__content">
          <h2 className="welcome-card__title">Welcome back, {internalUser?.name?.split(" ")[0]}!</h2>
          <p className="welcome-card__text">
            Stay updated with your latest leave status, timesheets, and company announcements.
          </p>
        </div>
        <div className="welcome-card__actions">
          <button className="btn btn--secondary" style={{ color: 'var(--primary-700)' }}>
             Request Leave
          </button>
        </div>
      </section>

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
        ))} statistics
      </section>

      <div className="content-grid">
        <div className="card" style={{ gridColumn: 'span 8' }}>
          <div className="card__header">
            <h3 className="card__title">Recent Announcements</h3>
            <button className="btn btn--ghost btn--sm">View All</button>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {[
                { title: "Summer Team Event 2026", date: "2 days ago", type: "Social", urgent: false },
                { title: "New Health Insurance Policy Update", date: "1 week ago", type: "HR", urgent: true },
                { title: "IT Maintenance Window - Sunday", date: "Oct 24", type: "IT", urgent: false },
              ].map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-3)', borderRadius: 'var(--rounded-lg)', border: '1px solid var(--neutral-100)' }}>
                  <div className={`badge ${item.urgent ? 'badge--urgent' : 'badge--it'}`}>
                    {item.type}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--neutral-800)' }}>{item.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>{item.date}</div>
                  </div>
                  <button className="btn btn--ghost btn--sm">Read</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 4' }}>
          <div className="card__header">
            <h3 className="card__title">Quick Access</h3>
          </div>
          <div className="card__body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
              {modules.slice(0, 4).map((mod, idx) => (
                <button key={idx} className="btn btn--secondary" style={{ height: 'auto', padding: 'var(--space-4)', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <span style={{ color: 'var(--primary-500)' }}>{mod.icon}</span>
                  <span style={{ fontSize: '0.75rem' }}>{mod.title}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="card__footer">
            <button className="btn btn--ghost btn--sm" style={{ width: '100%' }}>Customize Shortcuts</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
