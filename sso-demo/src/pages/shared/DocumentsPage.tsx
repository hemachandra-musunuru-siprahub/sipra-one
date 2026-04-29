import React, { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { FileText, Plus, Trash2, ExternalLink } from "lucide-react";
import { getDocuments, createDocument, deleteDocument } from "../../api/documents";
import type { HrDocument } from "../../api/types";

interface Props { internalUser: any; isHR?: boolean; role?: "Admin" | "HR" | "Manager" | "Employee"; }

export const DocumentsPage = ({ internalUser, isHR = false, role }: Props) => {
  const [documents, setDocuments] = useState<HrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", documentType: "", scope: "company" as "company" | "individual", onedriveUrl: "", assignedToOid: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getDocuments().then(d => setDocuments(d.documents)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = documents.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.document_type.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    setError(null);
    if (!form.title || !form.documentType || !form.onedriveUrl) { setError("Title, type and URL are required."); return; }
    if (form.scope === "individual" && !form.assignedToOid) { setError("Assigned To OID is required for individual documents."); return; }
    setSubmitting(true);
    try {
      const { document } = await createDocument({ ...form, assignedToOid: form.assignedToOid || undefined });
      setDocuments(prev => [document, ...prev]);
      setForm({ title: "", description: "", documentType: "", scope: "company", onedriveUrl: "", assignedToOid: "" });
      setShowForm(false);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (e: any) { alert(e.message); }
  };

  const userRoles = internalUser?.roles || [];
  let role: "Admin" | "HR" | "Manager" | "Employee" = "Employee";
  if (userRoles.includes("Admin") || userRoles.includes("SipraHub-SystemAdmin")) role = "Admin";
  else if (userRoles.includes("HR") || userRoles.includes("SipraHub-HR")) role = "HR";
  else if (userRoles.includes("Manager") || userRoles.includes("SipraHub-Manager")) role = "Manager";

  return (
    <DashboardLayout internalUser={internalUser} role={layoutRole}>
      <header className="page-header">
        <div className="breadcrumb">
          <span>{layoutRole}</span><span className="breadcrumb__separator">/</span><span>Documents</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">HR Documents</h1>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <input className="input" style={{ width: 220 }} placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} />
            {isHR && <button className="btn btn--primary" onClick={() => setShowForm(v => !v)}><Plus size={16} /> Add Document</button>}
          </div>
        </div>
      </header>

      {isHR && showForm && (
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="card__header"><h3 className="card__title">Add Document Record</h3></div>
          <div className="card__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div><label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Title *</label><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Document Type *</label><input className="input" placeholder="e.g. Policy, Contract, Handbook" value={form.documentType} onChange={e => setForm(f => ({ ...f, documentType: e.target.value }))} /></div>
            <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>OneDrive URL *</label><input className="input" type="url" placeholder="https://..." value={form.onedriveUrl} onChange={e => setForm(f => ({ ...f, onedriveUrl: e.target.value }))} /></div>
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Scope *</label>
              <select className="input" value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as any }))}>
                <option value="company">Company-wide</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            {form.scope === "individual" && (
              <div><label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Assigned To (OID) *</label><input className="input" placeholder="Employee Entra OID" value={form.assignedToOid} onChange={e => setForm(f => ({ ...f, assignedToOid: e.target.value }))} /></div>
            )}
            <div style={{ gridColumn: "span 2" }}><label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Description</label><textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: "vertical" }} /></div>
          </div>
          {error && <div style={{ padding: "0 var(--space-6)", color: "var(--error-600)", fontSize: "0.875rem" }}>{error}</div>}
          <div className="card__footer" style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--primary" onClick={handleCreate} disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
            <button className="btn btn--secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="content-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {loading ? (
          <div className="card"><div className="card__body" style={{ color: "var(--neutral-500)" }}>Loading…</div></div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ gridColumn: "span 3" }}><div className="card__body" style={{ textAlign: "center", color: "var(--neutral-500)" }}>No documents found.</div></div>
        ) : filtered.map(doc => (
          <div className="card" key={doc.id}>
            <div className="card__header" style={{ alignItems: "flex-start" }}>
              <div>
                <span className={`badge ${doc.scope === "company" ? "badge--published" : "badge--hr"}`} style={{ marginBottom: "var(--space-2)", display: "inline-block" }}>{doc.scope}</span>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--neutral-900)", margin: 0 }}>{doc.title}</h3>
              </div>
              <FileText size={20} style={{ color: "var(--neutral-400)", flexShrink: 0 }} />
            </div>
            <div className="card__body">
              <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginBottom: "var(--space-2)" }}>{doc.document_type}</div>
              {doc.description && <p style={{ fontSize: "0.875rem", color: "var(--neutral-600)", lineHeight: 1.5 }}>{doc.description}</p>}
            </div>
            <div className="card__footer" style={{ display: "flex", gap: "var(--space-2)" }}>
              <a href={doc.onedrive_url} target="_blank" rel="noreferrer" className="btn btn--primary btn--sm" style={{ flex: 1 }}>
                <ExternalLink size={14} /> Open
              </a>
              {isHR && (
                <button className="btn btn--ghost btn--sm" style={{ color: "var(--error-500)" }} onClick={() => handleDelete(doc.id)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};
