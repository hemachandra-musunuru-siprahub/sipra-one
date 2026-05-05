import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { useNavigate } from "react-router-dom";
import {
  Users, Calendar, FileText, Plus, Megaphone
} from "lucide-react";
import { getAllLeave } from "../api/leave";
import { getDocuments } from "../api/documents";

import { TopAnnouncementsCarousel } from "./TopAnnouncementsCarousel";
import { getAnnouncements, createAnnouncement } from "../api/announcements";
import type { LeaveRequest, HrDocument, Announcement } from "../api/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { internalUser: any; }

export const HRDashboard = ({ internalUser }: Props) => {
  const navigate = useNavigate();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [documents, setDocuments] = useState<HrDocument[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Announcement state
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newPinned, setNewPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getAllLeave(), getDocuments(), getAnnouncements(1, 5)])
      .then(([leaveData, docsData, annData]) => {
        setLeaveRequests(leaveData.requests);
        setDocuments(docsData.documents);
        setAnnouncements(annData.announcements);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pendingLeave = leaveRequests.filter(r => r.status === "pending");

  const stats = [
    { label: "Total Headcount", value: loading ? "—" : "—", trend: "From Entra ID", icon: <Users size={20} />, color: "#CE2124" },
    { label: "Pending Leave", value: loading ? "…" : `${pendingLeave.length}`, trend: "Requires Action", icon: <Calendar size={20} />, color: "#F59E0B" },
    { label: "Company Documents", value: loading ? "…" : `${documents.filter(d => d.scope === "company").length}`, trend: "Active Policies", icon: <FileText size={20} />, color: "#3B82F6" },
    { label: "Announcements", value: loading ? "…" : `${announcements.length}`, trend: "This month", icon: <Megaphone size={20} />, color: "#10B981" },
  ];

  const handleCreateAnnouncement = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    try {
      const { announcement } = await createAnnouncement({ title: newTitle, body: newBody, category: newCategory || undefined, isPinned: newPinned });
      setAnnouncements(prev => [announcement, ...prev]);
      setNewTitle(""); setNewBody(""); setNewCategory(""); setNewPinned(false); setShowForm(false);
    } catch (e) { console.error(e); } finally { setSubmitting(false); }
  };



  return (
    <DashboardLayout internalUser={internalUser} role="HR">
      <header className="page-header">
        <div className="breadcrumb">
          <span>Home</span>
          <span className="breadcrumb__separator">/</span>
          <span>HR Dashboard</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">People &amp; Culture</h1>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--secondary"><FileText size={16} /> Export Reports</button>
            <button className="btn btn--primary" onClick={() => setShowForm(v => !v)}>
              <Plus size={16} /> New Announcement
            </button>
          </div>
        </div>
      </header>

      {/* Create Announcement Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="card__header"><h3 className="card__title">New Announcement</h3></div>
          <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <input className="input" placeholder="Title *" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
            <textarea className="input" rows={4} placeholder="Body *" value={newBody} onChange={e => setNewBody(e.target.value)} style={{ resize: "vertical" }} />
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <input className="input" style={{ flex: 1 }} placeholder="Category (optional)" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.875rem" }}>
                <input type="checkbox" checked={newPinned} onChange={e => setNewPinned(e.target.checked)} /> Pin to top
              </label>
            </div>
          </div>
          <div className="card__footer" style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--primary" onClick={handleCreateAnnouncement} disabled={submitting}>
              {submitting ? "Publishing…" : "Publish"}
            </button>
            <button className="btn btn--secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <section className="welcome-card" style={{ height: "140px", padding: "var(--space-6) var(--space-10)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "var(--space-6)" }}>
        <div className="welcome-card__content" style={{ textAlign: "center", width: "100%" }}>
          <h1 className="welcome-card__title" style={{ fontSize: "2.5rem", fontWeight: 700, margin: 0, color: "white" }}>
            Welcome back, {internalUser?.name?.split(" ")[0] || "there"}!
          </h1>
        </div>
      </section>

      <TopAnnouncementsCarousel />

      <section className="stats-grid">
        {stats.map((stat, idx) => (
          <div className="stat-card" key={idx}>
            <div className="stat-card__header">
              <div className="stat-card__icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>{stat.icon}</div>
              <span className="stat-card__trend" style={{ color: stat.color }}>{stat.trend}</span>
            </div>
            <div>
              <div className="stat-card__label">{stat.label}</div>
              <div className="stat-card__value">{stat.value}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="content-grid">
        {/* Pending Leave Requests */}
        <div className="card" style={{ gridColumn: "span 8" }}>
          <div className="card__header">
            <h3 className="card__title">Pending Leave Requests</h3>
            <span className="badge badge--urgent">{pendingLeave.length} Pending</span>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Employee OID</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading…</td></tr>
                ) : pendingLeave.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No pending requests</td></tr>
                ) : pendingLeave.slice(0, 6).map((req) => (
                  <tr key={req.id}>
                    <td><span style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{req.employee_oid.slice(0, 8)}…</span></td>
                    <td><span className="badge badge--hr">{req.leave_type}</span></td>
                    <td style={{ fontSize: "0.875rem" }}>{req.start_date} → {req.end_date}</td>
                    <td>{req.total_days}</td>
                    <td><span className="badge badge--draft">{req.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card__footer">
            <button className="btn btn--ghost btn--sm" style={{ width: "100%" }} onClick={() => navigate("/hr/leave")}>View All Leave Requests →</button>
          </div>
        </div>

        {/* HR Modules */}
        <div className="card" style={{ gridColumn: "span 4" }}>
          <div className="card__header"><h3 className="card__title">HR Modules</h3></div>
          <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {[
              { label: "Leave Management", icon: <Calendar size={18} />, color: "var(--dept-hr)", path: "/hr/leave" },
              { label: "Document Management", icon: <FileText size={18} />, color: "var(--dept-it)", path: "/hr/documents" },
              { label: "Announcements", icon: <Megaphone size={18} />, color: "var(--dept-comm)", path: "/hr/announcements" },
            ].map((mod, idx) => (
              <button key={idx} className="btn btn--secondary" style={{ justifyContent: "flex-start", padding: "var(--space-4)" }} onClick={() => navigate(mod.path)}>
                <span style={{ color: mod.color }}>{mod.icon}</span>
                <span style={{ flex: 1, textAlign: "left" }}>{mod.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Company Documents + Latest Updates side by side */}
        <div className="card" style={{ gridColumn: "span 12" }}>
          <div className="card__header">
            <h3 className="card__title">Company Documents</h3>
            <button className="btn btn--ghost btn--sm" onClick={() => navigate("/hr/documents")}>View All</button>
          </div>
          <div className="card__body">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {loading ? (
                <p style={{ color: "var(--neutral-500)", fontSize: "0.875rem" }}>Loading…</p>
              ) : documents.length === 0 ? (
                <p style={{ color: "var(--neutral-500)", fontSize: "0.875rem" }}>No documents yet. Add one from the HR Documents page.</p>
              ) : documents.slice(0, 4).map((doc) => (
                <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3)", border: "1px solid var(--neutral-100)", borderRadius: "var(--rounded-lg)" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{doc.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{doc.document_type}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <span className={`badge ${doc.scope === "company" ? "badge--published" : "badge--draft"}`}>{doc.scope}</span>
                    <a href={doc.onedrive_url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">Open</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
