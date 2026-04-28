import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Megaphone, ThumbsUp, Heart, Smile, Plus } from "lucide-react";
import { getAnnouncements, reactToAnnouncement, removeReaction, createAnnouncement } from "../../api/announcements";
import type { Announcement } from "../../api/types";

interface Props { internalUser: any; isHR?: boolean; }

const REACTIONS = [
  { type: "thumbs_up", icon: "👍" },
  { type: "heart",     icon: "❤️" },
  { type: "laugh",     icon: "😄" },
  { type: "surprised", icon: "😮" },
  { type: "sad",       icon: "😢" },
];

export const AnnouncementsPage = ({ internalUser, isHR = false }: Props) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", category: "", isPinned: false });
  const [submitting, setSubmitting] = useState(false);

  const loadPage = useCallback((p: number) => {
    setLoading(true);
    getAnnouncements(p, 10)
      .then(d => {
        if (p === 1) setAnnouncements(d.announcements);
        else setAnnouncements(prev => [...prev, ...d.announcements]);
        setHasMore(d.announcements.length === 10);
        setPage(p);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPage(1); }, [loadPage]);

  const handleReact = async (id: string, reactionType: string) => {
    try {
      await reactToAnnouncement(id, reactionType);
      loadPage(1);
    } catch (e) { console.error(e); }
  };

  const handlePublish = async () => {
    if (!form.title || !form.body) return;
    setSubmitting(true);
    try {
      await createAnnouncement(form);
      setForm({ title: "", body: "", category: "", isPinned: false });
      setShowForm(false);
      loadPage(1);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const role = isHR ? "HR" : "Employee";

  return (
    <DashboardLayout internalUser={internalUser} role={role}>
      <header className="page-header">
        <div className="breadcrumb">
          <span>{role}</span><span className="breadcrumb__separator">/</span><span>Announcements</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Company Announcements</h1>
          {isHR && (
            <button className="btn btn--primary" onClick={() => setShowForm(v => !v)}>
              <Plus size={16} /> New Announcement
            </button>
          )}
        </div>
      </header>

      {isHR && showForm && (
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="card__header"><h3 className="card__title">New Announcement</h3></div>
          <div className="card__body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <input className="input" placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <textarea className="input" rows={5} placeholder="Body *" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} style={{ resize: "vertical" }} />
            <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
              <input className="input" style={{ flex: 1 }} placeholder="Category (e.g. IT, HR, Social)" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "0.875rem" }}>
                <input type="checkbox" checked={form.isPinned} onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))} /> 📌 Pin to top
              </label>
            </div>
          </div>
          <div className="card__footer" style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--primary" onClick={handlePublish} disabled={submitting}>{submitting ? "Publishing…" : "Publish"}</button>
            <button className="btn btn--secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {loading && announcements.length === 0 ? (
          <div className="card"><div className="card__body" style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading announcements…</div></div>
        ) : announcements.length === 0 ? (
          <div className="card"><div className="card__body" style={{ textAlign: "center", color: "var(--neutral-500)" }}>No announcements yet.</div></div>
        ) : announcements.map(ann => (
          <div className="card" key={ann.id} style={{ borderLeft: ann.is_pinned ? "3px solid var(--primary-500)" : undefined }}>
            <div className="card__header">
              <div>
                {ann.is_pinned && <span style={{ fontSize: "0.75rem", color: "var(--primary-500)", fontWeight: 600, display: "block", marginBottom: "var(--space-1)" }}>📌 PINNED</span>}
                <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--neutral-900)" }}>{ann.title}</h3>
                <div style={{ fontSize: "0.75rem", color: "var(--neutral-400)", marginTop: "var(--space-1)" }}>
                  {new Date(ann.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  {ann.category && <span className="badge badge--it" style={{ marginLeft: "var(--space-2)", fontSize: "0.7rem" }}>{ann.category}</span>}
                </div>
              </div>
            </div>
            <div className="card__body">
              <p style={{ color: "var(--neutral-700)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{ann.body}</p>
            </div>
            <div className="card__footer" style={{ display: "flex", gap: "var(--space-3)" }}>
              {REACTIONS.map(r => {
                const count = ann.reactions?.[r.type] || 0;
                return (
                  <button
                    key={r.type}
                    className="btn btn--ghost btn--sm"
                    style={{ fontSize: "0.875rem", gap: "var(--space-1)" }}
                    onClick={() => handleReact(ann.id, r.type)}
                  >
                    {r.icon} {count > 0 && <span style={{ fontWeight: 600 }}>{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {hasMore && !loading && (
          <button className="btn btn--secondary" style={{ width: "100%" }} onClick={() => loadPage(page + 1)}>
            Load more
          </button>
        )}
        {loading && announcements.length > 0 && (
          <p style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading…</p>
        )}
      </div>
    </DashboardLayout>
  );
};
