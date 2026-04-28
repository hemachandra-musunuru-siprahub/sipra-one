import React, { useState, useEffect } from "react";
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
    { id: "docs", title: "My Documents", desc: "Access policies & contracts", icon: <FileText /> },
    { id: "news", title: "Company News", desc: "Latest internal announcements", icon: <Megaphone /> },
    { id: "support", title: "Help & Support", desc: "IT & HR service desk", icon: <HelpCircle /> },
  ];
  
  const [performanceData, setPerformanceData] = useState<{ goals: any[], reviews: any[] }>({ goals: [], reviews: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        const response = await fetch("/api/performance/me");
        if (response.ok) {
          const data = await response.json();
          setPerformanceData(data);
        }
      } catch (error) {
        console.error("Failed to fetch performance data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPerformance();
  }, []);

  const latestReview = performanceData.reviews.length > 0 ? performanceData.reviews[0] : null;

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

        {/* New Performance Module Card */}
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <div className="card__header">
            <h3 className="card__title">My Performance</h3>
            <button className="btn btn--secondary btn--sm">View Full History</button>
          </div>
          <div className="card__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' }}>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--neutral-800)', marginBottom: 'var(--space-3)' }}>Current Goals</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {loading ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Loading goals...</p>
                ) : performanceData.goals.length > 0 ? (
                  performanceData.goals.map((goal, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{goal.title}</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{goal.progress_percent}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--neutral-100)', borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${goal.progress_percent}%`, background: 'var(--primary-500)', borderRadius: 3 }}></div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>No goals assigned yet.</p>
                )}
              </div>
            </div>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--neutral-800)', marginBottom: 'var(--space-3)' }}>Latest Review</h4>
              {loading ? (
                <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Loading review...</p>
              ) : latestReview ? (
                <div style={{ padding: 'var(--space-4)', background: 'var(--neutral-50)', borderRadius: 'var(--rounded-lg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: latestReview.rating >= 4 ? 'var(--success-600)' : 'var(--neutral-800)' }}>
                      {latestReview.rating === 5 ? "Outstanding" : latestReview.rating === 4 ? "Exceeds Expectations" : latestReview.rating === 3 ? "Meets Expectations" : "Needs Improvement"}
                    </div>
                    <div className="badge badge--published">{latestReview.review_period}</div>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--neutral-600)', lineHeight: 1.5, fontStyle: 'italic' }}>
                    "{latestReview.comments || "No comments provided."}"
                  </p>
                  <div style={{ marginTop: 'var(--space-3)', fontSize: '0.75rem', color: 'var(--neutral-400)' }}>
                    - Manager Comment
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>No reviews recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
