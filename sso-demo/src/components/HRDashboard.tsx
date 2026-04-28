import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { 
  Users, 
  UserPlus, 
  Calendar, 
  FileText, 
  TrendingUp,
  BarChart2,
  DollarSign,
  Search,
  Filter,
  Plus
} from "lucide-react";

interface Props {
  internalUser: any;
}

export const HRDashboard = ({ internalUser }: Props) => {
  const stats = [
    { label: "Total Headcount", value: "156", trend: "+4 this month", icon: <Users size={20} />, color: "#CE2124" },
    { label: "Performance Reviews", value: "85%", trend: "In Progress", icon: <TrendingUp size={20} />, color: "#3B82F6" },
    { label: "Pending Leave", value: "24", trend: "Requires Action", icon: <Calendar size={20} />, color: "#F59E0B" },
    { label: "Monthly Retention", value: "98.2%", trend: "Above Target", icon: <TrendingUp size={20} />, color: "#10B981" },
  ];

  const [reportData, setReportData] = useState<{ ratingDistribution: any[], completionByEmployee: any[] }>({ ratingDistribution: [], completionByEmployee: [] });
  const [loading, setLoading] = useState(true);

  const recentHires = [
    { name: "Alice Thompson", role: "Software Engineer", dept: "IT & Digital", startDate: "Oct 15", status: "Onboarding" },
    { name: "Bob Richards", role: "Financial Analyst", dept: "Finance", startDate: "Oct 20", status: "Pending" },
    { name: "Catherine Low", role: "HR Coordinator", dept: "HR & People", startDate: "Oct 1", status: "Active" },
  ];

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch("/api/performance/reports");
        if (response.ok) {
          const data = await response.json();
          setReportData(data);
        }
      } catch (error) {
        console.error("Failed to fetch performance reports:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const totalReviews = reportData.completionByEmployee.length;
  const completedReviews = reportData.completionByEmployee.filter(e => parseInt(e.review_count) > 0).length;
  const completionPercent = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0;
  
  const topPerformers = reportData.completionByEmployee
    .filter(e => parseInt(e.review_count) > 0)
    .slice(0, 3); // Simple slice for demo

  return (
    <DashboardLayout internalUser={internalUser} role="HR">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Home</span>
          <span className="breadcrumb__separator">/</span>
          <span>HR Dashboard</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title">People & Culture</h1>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
             <button className="btn btn--secondary">
                <FileText size={16} />
                Generate Reports
             </button>
             <button className="btn btn--primary">
                <Plus size={16} />
                New Employee
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
            <h3 className="card__title">Employee Lifecycle Tracking</h3>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
               <button className="btn btn--ghost btn--sm">
                  <Search size={14} />
               </button>
               <button className="btn btn--ghost btn--sm">
                  <Filter size={14} />
               </button>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Start Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentHires.map((hire, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className="avatar avatar--sm" style={{ width: 28, height: 28 }}>{hire.name[0]}</div>
                        <span style={{ fontWeight: 500 }}>{hire.name}</span>
                      </div>
                    </td>
                    <td>{hire.role}</td>
                    <td>
                       <span className={`badge ${hire.dept === 'HR & People' ? 'badge--hr' : hire.dept === 'Finance' ? 'badge--finance' : 'badge--it'}`}>
                          {hire.dept}
                       </span>
                    </td>
                    <td>{hire.startDate}</td>
                    <td>
                      <span className={`badge ${hire.status === 'Active' ? 'badge--published' : 'badge--draft'}`}>
                         {hire.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card__footer">
            <button className="btn btn--ghost btn--sm" style={{ width: '100%' }}>View All Employee Records</button>
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 4' }}>
          <div className="card__header">
            <h3 className="card__title">HR Modules</h3>
          </div>
          <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[
              { label: "Leave Management", icon: <Calendar size={18} />, color: "var(--dept-hr)" },
              { label: "HR Analytics", icon: <TrendingUp size={18} />, color: "var(--dept-comm)" },
              { label: "Document Management", icon: <FileText size={18} />, color: "var(--dept-it)" },
            ].map((mod, idx) => (
              <button key={idx} className="btn btn--secondary" style={{ justifyContent: 'flex-start', padding: 'var(--space-4)' }}>
                <span style={{ color: mod.color }}>{mod.icon}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{mod.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 6' }}>
          <div className="card__header">
            <h3 className="card__title">Leave Requests by Department</h3>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {[
                { dept: "IT & Digital", count: 8, total: 10 },
                { dept: "Finance", count: 4, total: 10 },
                { dept: "Operations", count: 12, total: 15 },
              ].map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.dept}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.count}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--neutral-100)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${(item.count/item.total)*100}%`, background: 'var(--primary-400)', borderRadius: 3 }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 6' }}>
          <div className="card__header">
            <h3 className="card__title">Policy Management</h3>
          </div>
          <div className="card__body">
             <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[
                  { name: "Code of Conduct 2026", status: "Published", date: "Last updated Oct 12" },
                  { name: "Remote Work Policy", status: "In Review", date: "Last updated Oct 20" },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', border: '1px solid var(--neutral-100)', borderRadius: 'var(--rounded-lg)' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>{item.date}</div>
                    </div>
                    <span className={`badge ${item.status === 'Published' ? 'badge--published' : 'badge--draft'}`}>{item.status}</span>
                  </div>
                ))}
             </div>
          </div>
          <div className="card__footer">
            <button className="btn btn--primary" style={{ width: '100%' }}>Manage Policy Vault</button>
          </div>
        </div>

        {/* New Performance Module Card */}
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <div className="card__header">
            <h3 className="card__title">Performance Reports</h3>
            <button className="btn btn--secondary btn--sm">Download Summary</button>
          </div>
          <div className="card__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-6)' }}>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--neutral-800)', marginBottom: 'var(--space-3)' }}>Review Completion</h4>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-600)', lineHeight: 1 }}>{loading ? "..." : `${completionPercent}%`}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--neutral-500)', paddingBottom: '4px' }}>of headcount</div>
              </div>
              <div style={{ height: 8, background: 'var(--neutral-100)', borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${completionPercent}%`, background: 'var(--primary-500)', borderRadius: 4 }}></div>
              </div>
              <div style={{ marginTop: 'var(--space-3)', fontSize: '0.875rem', color: 'var(--neutral-500)' }}>
                {loading ? "Calculating..." : `${completedReviews} of ${totalReviews} reviews completed`}
              </div>
            </div>
            
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--neutral-800)', marginBottom: 'var(--space-3)' }}>Rating Distribution</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {loading ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Loading ratings...</p>
                ) : reportData.ratingDistribution.length > 0 ? (
                  reportData.ratingDistribution.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2)', borderBottom: '1px solid var(--neutral-100)' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--neutral-600)' }}>Rating: {item.rating} Stars</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--neutral-800)' }}>{item.count} employees</span>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>No ratings yet.</p>
                )}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--neutral-800)', marginBottom: 'var(--space-3)' }}>Sample Top Performers</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                {loading ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Loading...</p>
                ) : topPerformers.length > 0 ? (
                  topPerformers.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2)' }}>
                      <div>
                        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--neutral-800)' }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>Review Count: {item.review_count}</div>
                      </div>
                      <div className="badge badge--published" style={{ fontSize: '0.75rem' }}>Active</div>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>No data available.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
