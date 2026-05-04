import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { 
  FileText, Plus, Trash2, ExternalLink, HardDrive, 
  Search as SearchIcon, Folder, File, CheckCircle, 
  ChevronLeft, X, Loader2, Users as UsersIcon,
  Check
} from "lucide-react";
import { 
  getDocuments, createDocument, deleteDocument, 
  browseOneDrive, searchOneDrive, createShareLink, shareDocument 
} from "../../api/documents";
import { getUsers } from "../../api/users";
import type { HrDocument, User } from "../../api/types";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../../authConfig";

interface Props { internalUser: any; isHR?: boolean; role?: "Admin" | "HR" | "Manager" | "Employee"; }

export const DocumentsPage = ({ internalUser, isHR = false, role }: Props) => {
  const { instance, accounts } = useMsal();
  const [documents, setDocuments] = useState<HrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", documentType: "", scope: "company" as "company" | "individual", onedriveUrl: "", assignedToOid: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // OneDrive Share Flow State
  const [showOneDriveModal, setShowOneDriveModal] = useState(false);
  const [oneDriveStep, setOneDriveStep] = useState<"browse" | "share">("browse");
  const [odItems, setOdItems] = useState<any[]>([]);
  const [odLoading, setOdLoading] = useState(false);
  const [odFolderId, setOdFolderId] = useState<string | undefined>(undefined);
  const [odSearch, setOdSearch] = useState("");
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  const [selectedEmpOids, setSelectedEmpOids] = useState<string[]>([]);
  const [shareDocType, setShareDocType] = useState("Shared Document");
  const [shareDesc, setShareDesc] = useState("");

  const fetchDocs = useCallback(() => {
    setLoading(true);
    getDocuments()
      .then(d => setDocuments(d.documents))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

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

  // ─── OneDrive Flow ──────────────────────────────────────────────────────────
  
  const getAccessToken = async () => {
    const request = { ...loginRequest, account: accounts[0] };
    const response = await instance.acquireTokenSilent(request);
    return response.accessToken;
  };

  const loadOneDrive = async (folderId?: string) => {
    setOdLoading(true);
    try {
      const token = await getAccessToken();
      const items = await browseOneDrive(token, folderId);
      setOdItems(items);
      setOdFolderId(folderId);
      setOdSearch("");
    } catch (e) {
      console.error(e);
    } finally {
      setOdLoading(false);
    }
  };

  const handleOdSearch = async () => {
    if (!odSearch.trim()) { loadOneDrive(odFolderId); return; }
    setOdLoading(true);
    try {
      const token = await getAccessToken();
      const items = await searchOneDrive(token, odSearch);
      setOdItems(items);
    } catch (e) {
      console.error(e);
    } finally {
      setOdLoading(false);
    }
  };

  const openOneDriveFlow = () => {
    setShowOneDriveModal(true);
    setOneDriveStep("browse");
    setSelectedFile(null);
    setSelectedEmpOids([]);
    loadOneDrive();
    // Load employees for next step
    getUsers().then(data => setAllEmployees(data.users.filter(u => u.is_active))).catch(console.error);
  };

  const handleFileSelect = (item: any) => {
    setSelectedFile(item);
    setOneDriveStep("share");
  };

  const toggleEmp = (oid: string) => {
    setSelectedEmpOids(prev => prev.includes(oid) ? prev.filter(x => x !== oid) : [...prev, oid]);
  };

  const handleShare = async () => {
    if (!selectedFile || selectedEmpOids.length === 0) return;
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      // 1. Create a sharing link for the file
      const shareUrl = await createShareLink(token, selectedFile.id, selectedFile.webUrl);
      
      // 2. Save metadata to backend
      await shareDocument({
        fileName: selectedFile.name,
        onedriveUrl: shareUrl,
        driveItemId: selectedFile.id,
        documentType: shareDocType,
        description: shareDesc,
        recipientOids: selectedEmpOids
      });
      
      setShowOneDriveModal(false);
      fetchDocs(); // Refresh documents list
      alert(`Shared "${selectedFile.name}" with ${selectedEmpOids.length} employees.`);
    } catch (e: any) {
      alert("Sharing failed: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const displayRole = React.useMemo(() => {
    if (role) {
      if (role.toLowerCase() === "hr") return "HR";
      return role;
    }
    const userRoles = internalUser?.roles || [];
    if (userRoles.some((r: string) => ["Admin", "SipraHub-SystemAdmin"].includes(r))) return "Admin";
    if (userRoles.some((r: string) => ["HR", "SipraHub-HR"].includes(r)) || isHR) return "HR";
    if (userRoles.some((r: string) => ["Manager", "SipraHub-Manager"].includes(r))) return "Manager";
    return "Employee";
  }, [role, internalUser, isHR]);

  return (
    <DashboardLayout internalUser={internalUser} role={displayRole}>
      <header className="page-header">
        <div className="breadcrumb">
          <span>{displayRole}</span><span className="breadcrumb__separator">/</span><span>Documents</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">HR Documents</h1>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <div className="search-input-wrapper">
              <SearchIcon size={16} className="search-icon" />
              <input className="input" style={{ width: 220, paddingLeft: 36 }} placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {isHR && (
              <>
                <button className="btn btn--secondary" onClick={openOneDriveFlow}><HardDrive size={16} /> Share from OneDrive</button>
                <button className="btn btn--primary" onClick={() => setShowForm(v => !v)}><Plus size={16} /> Add Record</button>
              </>
            )}
          </div>
        </div>
      </header>

      {isHR && showForm && (
        <div className="card animate-fade-in" style={{ marginBottom: "var(--space-6)" }}>
          <div className="card__header"><h3 className="card__title">Add Document Record</h3></div>
          <div className="card__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div className="form-field"><label className="form-label">Title *</label><input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div className="form-field"><label className="form-label">Document Type *</label><input className="input" placeholder="e.g. Policy, Contract, Handbook" value={form.documentType} onChange={e => setForm(f => ({ ...f, documentType: e.target.value }))} /></div>
            <div className="form-field" style={{ gridColumn: "span 2" }}><label className="form-label">OneDrive URL *</label><input className="input" type="url" placeholder="https://..." value={form.onedriveUrl} onChange={e => setForm(f => ({ ...f, onedriveUrl: e.target.value }))} /></div>
            <div className="form-field">
              <label className="form-label">Scope *</label>
              <select className="input" value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value as any }))}>
                <option value="company">Company-wide</option>
                <option value="individual">Individual</option>
              </select>
            </div>
            {form.scope === "individual" && (
              <div className="form-field"><label className="form-label">Assigned To (OID) *</label><input className="input" placeholder="Employee Entra OID" value={form.assignedToOid} onChange={e => setForm(f => ({ ...f, assignedToOid: e.target.value }))} /></div>
            )}
            <div className="form-field" style={{ gridColumn: "span 2" }}><label className="form-label">Description</label><textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: "vertical" }} /></div>
          </div>
          {error && <div className="form-error-summary">{error}</div>}
          <div className="card__footer" style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--primary" onClick={handleCreate} disabled={submitting}>{submitting ? "Saving…" : "Save Record"}</button>
            <button className="btn btn--secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className={isHR ? "" : "content-grid"} style={isHR ? {} : { gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {loading ? (
          <div className="card" style={{ gridColumn: "1 / -1" }}><div className="card__body" style={{ textAlign: "center", padding: "var(--space-12)" }}><Loader2 size={32} className="animate-spin" style={{ margin: "0 auto var(--space-4)", color: "var(--neutral-400)" }} /><p style={{ color: "var(--neutral-500)" }}>Loading documents…</p></div></div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ gridColumn: "1 / -1" }}><div className="card__body" style={{ textAlign: "center", padding: "var(--space-12)", color: "var(--neutral-500)" }}>No documents found matching your search.</div></div>
        ) : isHR ? (
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Type</th>
                    <th>Shared With</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(doc => {
                    const isSharedByMe = doc.created_by_oid === internalUser?.entra_oid;
                    return (
                      <tr key={doc.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                            <FileText size={18} style={{ color: "var(--primary-500)" }} />
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--neutral-900)" }}>{doc.title}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{doc.scope}</div>
                            </div>
                          </div>
                        </td>
                        <td><span className="badge badge--neutral">{doc.document_type}</span></td>
                        <td>
                          {doc.scope === "company" ? (
                            <span style={{ fontSize: "0.8125rem", color: "var(--success-600)", fontWeight: 500 }}>All Employees</span>
                          ) : (
                            <div>
                              <div style={{ fontSize: "0.8125rem", fontWeight: 600 }}>{doc.assigned_to_name || "Unknown"}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{doc.assigned_to_email || doc.assigned_to_oid}</div>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--neutral-600)" }}>
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                            <a href={doc.onedrive_url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
                              <ExternalLink size={14} />
                            </a>
                            <button className="btn btn--ghost btn--sm" style={{ color: "var(--error-500)" }} onClick={() => handleDelete(doc.id)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          filtered.map(doc => (
            <div className="card card--interactive" key={doc.id}>
              <div className="card__header" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                    <span className={`badge ${doc.scope === "company" ? "badge--published" : "badge--hr"}`}>{doc.scope}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{doc.document_type}</span>
                  </div>
                  <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--neutral-900)", margin: 0, lineHeight: 1.4 }}>{doc.title}</h3>
                </div>
                <div className="document-icon-wrapper">
                  <FileText size={20} />
                </div>
              </div>
              <div className="card__body">
                {doc.description ? (
                  <p style={{ fontSize: "0.875rem", color: "var(--neutral-600)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{doc.description}</p>
                ) : <p style={{ fontSize: "0.875rem", color: "var(--neutral-400)", fontStyle: "italic" }}>No description provided.</p>}
                
                <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--neutral-100)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{new Date(doc.created_at).toLocaleDateString()}</span>
                  {doc.assigned_to_oid && <span style={{ fontSize: "0.75rem", color: "var(--primary-600)", fontWeight: 500 }}>Individual Access</span>}
                </div>
              </div>
              <div className="card__footer" style={{ display: "flex", gap: "var(--space-2)", background: "var(--neutral-50)" }}>
                <a href={doc.onedrive_url} target="_blank" rel="noreferrer" className="btn btn--primary btn--sm" style={{ flex: 1 }}>
                  <ExternalLink size={14} /> Open Document
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* OneDrive Modal */}
      {showOneDriveModal && (
        <div className="modal-overlay">
          <div className="modal-container" style={{ maxWidth: 800, width: "95%" }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {oneDriveStep === "browse" ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <HardDrive size={20} /> Browse OneDrive
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <UsersIcon size={20} /> Share "{selectedFile?.name}"
                  </div>
                )}
              </h2>
              <button className="modal-close" onClick={() => setShowOneDriveModal(false)}><X size={20} /></button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: "70vh", overflowY: "auto", padding: 0 }}>
              {oneDriveStep === "browse" ? (
                <>
                  <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--neutral-100)", display: "flex", gap: "var(--space-2)" }}>
                    <button className="btn btn--ghost btn--sm" onClick={() => loadOneDrive()} disabled={!odFolderId}><ChevronLeft size={16} /> Root</button>
                    <div className="search-input-wrapper" style={{ flex: 1 }}>
                      <SearchIcon size={16} className="search-icon" />
                      <input 
                        className="input" 
                        placeholder="Search files..." 
                        style={{ paddingLeft: 36 }}
                        value={odSearch}
                        onChange={e => setOdSearch(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleOdSearch()}
                      />
                    </div>
                    <button className="btn btn--primary btn--sm" onClick={handleOdSearch}>Search</button>
                  </div>
                  
                  <div className="onedrive-list">
                    {odLoading ? (
                      <div style={{ textAlign: "center", padding: "var(--space-12)" }}><Loader2 size={24} className="animate-spin" style={{ margin: "0 auto var(--space-2)" }} /><p>Loading files...</p></div>
                    ) : odItems.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "var(--space-12)", color: "var(--neutral-500)" }}>No files found.</div>
                    ) : odItems.map(item => (
                      <div 
                        key={item.id} 
                        className={`onedrive-item ${item.isFolder ? "folder" : "file"}`}
                        onClick={() => item.isFolder ? loadOneDrive(item.id) : handleFileSelect(item)}
                      >
                        <div className="item-icon">
                          {item.isFolder ? <Folder size={20} /> : <File size={20} />}
                        </div>
                        <div className="item-info">
                          <div className="item-name">{item.name}</div>
                          <div className="item-meta">{item.isFolder ? "Folder" : (item.size ? `${(item.size / 1024).toFixed(1)} KB` : "File")}</div>
                        </div>
                        {!item.isFolder && <div className="item-action">Select <ChevronLeft size={16} style={{ transform: "rotate(180deg)" }} /></div>}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ padding: "var(--space-6)" }}>
                  <div className="share-settings" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>
                    <div className="form-field">
                      <label className="form-label">Document Type</label>
                      <input className="input" value={shareDocType} onChange={e => setShareDocType(e.target.value)} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Description (Optional)</label>
                      <input className="input" value={shareDesc} onChange={e => setShareDesc(e.target.value)} />
                    </div>
                  </div>
                  
                  <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "var(--space-3)", display: "flex", justifyContent: "space-between" }}>
                    Select Employees ({selectedEmpOids.length} selected)
                    {selectedEmpOids.length > 0 && <button className="btn btn--ghost btn--sm" style={{ height: "auto", padding: 0 }} onClick={() => setSelectedEmpOids([])}>Clear</button>}
                  </h4>
                  
                  <div className="employee-selector-grid">
                    {allEmployees.map(emp => {
                      const isSelected = selectedEmpOids.includes(emp.entra_oid);
                      return (
                        <div 
                          key={emp.entra_oid} 
                          className={`employee-select-card ${isSelected ? "selected" : ""}`}
                          onClick={() => toggleEmp(emp.entra_oid)}
                        >
                          <div className="emp-avatar">{emp.name[0]}</div>
                          <div className="emp-info">
                            <div className="emp-name">{emp.name}</div>
                            <div className="emp-email">{emp.email}</div>
                          </div>
                          <div className="emp-check">
                            {isSelected ? <CheckCircle size={18} /> : <div className="check-placeholder" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn btn--secondary" 
                onClick={() => oneDriveStep === "share" ? setOneDriveStep("browse") : setShowOneDriveModal(false)}
              >
                {oneDriveStep === "share" ? "Back to Browse" : "Cancel"}
              </button>
              {oneDriveStep === "share" && (
                <button 
                  className="btn btn--primary" 
                  onClick={handleShare} 
                  disabled={submitting || selectedEmpOids.length === 0}
                >
                  {submitting ? <><Loader2 size={16} className="animate-spin" /> Sharing...</> : <><Check size={16} /> Share with {selectedEmpOids.length} Employees</>}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .search-input-wrapper { position: relative; }
        .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--neutral-400); pointer-events: none; }
        .document-icon-wrapper { width: 40px; height: 40px; background: var(--primary-50); color: var(--primary-600); border-radius: var(--rounded-lg); display: flex; alignItems: center; justify-content: center; flex-shrink: 0; }
        
        /* Modal Styles */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .modal-container { background: white; border-radius: var(--rounded-2xl); box-shadow: var(--shadow-2xl); overflow: hidden; display: flex; flex-direction: column; }
        .modal-header { padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--neutral-100); display: flex; justify-content: space-between; align-items: center; }
        .modal-title { font-size: 1.125rem; font-weight: 700; margin: 0; color: var(--neutral-900); }
        .modal-close { background: none; border: none; color: var(--neutral-400); cursor: pointer; padding: 4px; border-radius: 4px; }
        .modal-close:hover { background: var(--neutral-100); color: var(--neutral-600); }
        .modal-footer { padding: var(--space-4) var(--space-6); border-top: 1px solid var(--neutral-100); display: flex; justify-content: flex-end; gap: var(--space-3); background: var(--neutral-50); }
        
        /* OneDrive List */
        .onedrive-item { display: flex; align-items: center; padding: var(--space-3) var(--space-4); cursor: pointer; transition: background 0.2s; border-bottom: 1px solid var(--neutral-50); }
        .onedrive-item:hover { background: var(--primary-50); }
        .item-icon { margin-right: var(--space-4); color: var(--primary-500); }
        .item-name { font-size: 0.875rem; font-weight: 500; color: var(--neutral-900); }
        .item-meta { font-size: 0.75rem; color: var(--neutral-500); }
        .item-action { margin-left: auto; font-size: 0.75rem; font-weight: 600; color: var(--primary-600); opacity: 0; transform: translateX(4px); transition: 0.2s; }
        .onedrive-item:hover .item-action { opacity: 1; transform: translateX(0); }
        
        /* Employee Selector */
        .employee-selector-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); }
        .employee-select-card { display: flex; align-items: center; padding: var(--space-3); border: 1px solid var(--neutral-200); border-radius: var(--rounded-lg); cursor: pointer; transition: all 0.2s; position: relative; }
        .employee-select-card:hover { border-color: var(--primary-300); background: var(--primary-50); }
        .employee-select-card.selected { border-color: var(--primary-500); background: var(--primary-50); box-shadow: 0 0 0 1px var(--primary-500); }
        .emp-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--neutral-200); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; color: var(--neutral-600); margin-right: var(--space-3); }
        .selected .emp-avatar { background: var(--primary-500); color: white; }
        .emp-name { font-size: 0.8125rem; font-weight: 600; color: var(--neutral-900); }
        .emp-email { font-size: 0.75rem; color: var(--neutral-500); }
        .emp-check { margin-left: auto; color: var(--primary-500); }
        .check-placeholder { width: 18px; height: 18px; border: 1px solid var(--neutral-300); border-radius: 50%; }
        
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </DashboardLayout>
  );
};

