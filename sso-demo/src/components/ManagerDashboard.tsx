import React from "react";
import { DashboardLayout } from "./DashboardLayout";
import { 
  Users, 
  CheckSquare, 
  Clock, 
  TrendingUp,
  MoreVertical,
  Filter,
  Download
} from "lucide-react";

interface Props {
  internalUser: any;
}

export const ManagerDashboard = ({ internalUser }: Props) => {
  const stats = [
    { label: "Team Strength", value: "12 Members", trend: "Full Capacity", icon: <Users size={20} />, color: "#3B82F6" },
    { label: "Pending Approvals", value: "8 Requests", trend: "+3 since yesterday", icon: <CheckSquare size={20} />, color: "#CE2124" },
    { label: "Hours Logged", value: "480h", trend: "Current Period", icon: <Clock size={20} />, color: "#10B981" },
    { label: "Team Productivity", value: "94.5%", trend: "Up 2.1%", icon: <TrendingUp size={20} />, color: "#8B5CF6" },
  ];

  const pendingApprovals = [
    { name: "Sarah Johnson", type: "Annual Leave", duration: "3 days", date: "Oct 28 - Oct 30", status: "Pending" },
    { name: "Michael Chen", type: "Sick Leave", duration: "1 day", date: "Oct 24", status: "Pending" },
    { name: "Emily Davis", type: "Expense Claim", duration: "$120.50", date: "Travel", status: "Pending" },
    { name: "Robert Wilson", type: "Remote Work", duration: "2 days", date: "Oct 26 - Oct 27", status: "Pending" },
  ];

  return (
    <DashboardLayout internalUser={internalUser} role="Manager">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Home</span>
          <span className="breadcrumb__separator">/</span>
          <span>Manager Dashboard</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title">Team Overview</h1>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
             <button className="btn btn--secondary">
                <Download size={16} />
                Export Data
             </button>
             <button className="btn btn--primary">
                Team Settings
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
        <div className="card" style={{ gridColumn: 'span 12' }}>
          <div className="card__header">
            <h3 className="card__title">Pending Team Approvals</h3>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
               <button className="btn btn--ghost btn--sm">
                  <Filter size={14} />
                  Filter
               </button>
               <button className="btn btn--secondary btn--sm">Approve All</button>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Request Type</th>
                  <th>Duration/Amount</th>
                  <th>Dates/Details</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingApprovals.map((req, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div className="avatar avatar--sm" style={{ width: 28, height: 28 }}>{req.name[0]}</div>
                        <span style={{ fontWeight: 500 }}>{req.name}</span>
                      </div>
                    </td>
                    <td>{req.type}</td>
                    <td>{req.duration}</td>
                    <td>{req.date}</td>
                    <td>
                      <span className="badge badge--urgent">{req.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button className="btn btn--primary btn--sm" style={{ height: 28, fontSize: '0.75rem' }}>Approve</button>
                        <button className="btn btn--secondary btn--sm" style={{ height: 28, fontSize: '0.75rem' }}>Deny</button>
                        <button className="btn btn--ghost btn--sm" style={{ width: 28, height: 28, padding: 0 }}><MoreVertical size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card__footer">
             <span style={{ fontSize: '0.875rem', color: 'var(--neutral-500)' }}>Showing 4 of 8 pending requests</span>
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 6' }}>
          <div className="card__header">
            <h3 className="card__title">Team Timesheet Summary</h3>
          </div>
          <div className="card__body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {[
                { label: "Submitted", count: 10, color: "var(--success-500)" },
                { label: "In Progress", count: 2, color: "var(--warning-500)" },
                { label: "Overdue", count: 0, color: "var(--error-500)" },
              ].map((item, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.label}</span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.count}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--neutral-100)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${(item.count/12)*100}%`, background: item.color, borderRadius: 4 }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 6' }}>
          <div className="card__header">
            <h3 className="card__title">Upcoming Team Leaves</h3>
          </div>
          <div className="card__body">
             <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {[
                  { name: "John Doe", dates: "Oct 25 - Oct 27", type: "Annual" },
                  { name: "Jane Smith", dates: "Oct 30", type: "Personal" },
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3)', background: 'var(--neutral-50)', borderRadius: 'var(--rounded-lg)' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--neutral-500)' }}>{item.dates}</div>
                    </div>
                    <span className="badge badge--it">{item.type}</span>
                  </div>
                ))}
             </div>
          </div>
          <div className="card__footer">
            <button className="btn btn--ghost btn--sm" style={{ width: '100%' }}>View Team Calendar</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
