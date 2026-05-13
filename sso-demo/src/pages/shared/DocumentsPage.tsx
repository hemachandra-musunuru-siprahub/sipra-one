import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { 
  FileText, Plus, Trash2, ExternalLink, HardDrive, 
  Search as SearchIcon, Folder, File, CheckCircle, 
  ChevronLeft, X, Loader2, Users as UsersIcon,
  Check
} from "lucide-react";
import { 
  getDocuments, getAllDocuments, createDocument, deleteDocument,
  browseOneDrive, searchOneDrive, shareDocument, createShareLink
} from "../../api/documents";
import { getUsers } from "../../api/users";
import type { HrDocument, User } from "../../api/types";
import { useMsal } from "@azure/msal-react";

import { normalizeRole } from "../../lib/roleHelper";
import type { UserRole } from "../../lib/roleHelper";

interface Props { internalUser: any; isHR?: boolean; role?: string; }

export const DocumentsPage = ({ internalUser, isHR = false, role }: Props) => {
  const { instance, accounts } = useMsal();
  const [documents, setDocuments] = useState<HrDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", documentType: "", scope: "company" as "company" | "individual", onedriveUrl: "", assignedEmployeeId: "" });
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
  const [odError, setOdError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [selectedEmpOids, setSelectedEmpOids] = useState<string[]>([]);
  const [shareDocType, setShareDocType] = useState("Shared Document");
  const [shareDesc, setShareDesc] = useState("");

  const layoutRole: UserRole = normalizeRole(role || internalUser?.role || "employee");
  const isPrivileged = isHR || layoutRole === "Admin" || layoutRole === "HR";

  const fetchDocs = useCallback(() => {
    setLoading(true);
    const fetchPromise = isPrivileged ? getAllDocuments() : getDocuments();
    
    fetchPromise
      .then(d => setDocuments(d.documents))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isPrivileged]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const filtered = documents.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.document_type.toLowerCase().includes(search.toLowerCase())
  );

  const openOneDriveFlow = () => {
    setShowOneDriveModal(true);
    setOneDriveStep("browse");
    loadOneDrive();
  };

  const loadOneDrive = async (folderId?: string) => {
    setOdLoading(true);
    setOdError(null);
    try {
      if (!accounts[0]) throw new Error("No active Microsoft account found.");
      const response = await instance.acquireTokenSilent({
        scopes: ["Files.Read", "Files.ReadWrite"],
        account: accounts[0]
      });
      const items = await browseOneDrive(response.accessToken, folderId);
      setOdItems(items);
      setOdFolderId(folderId);
    } catch (e: any) {
      console.error(e);
      setOdError("Failed to load OneDrive items: " + e.message);
    } finally {
      setOdLoading(false);
    }
  };

  const handleOdSearch = async () => {
    if (!odSearch.trim()) return loadOneDrive();
    setOdLoading(true);
    setOdError(null);
    try {
      if (!accounts[0]) throw new Error("No active Microsoft account found.");
      const response = await instance.acquireTokenSilent({
        scopes: ["Files.Read", "Files.ReadWrite"],
        account: accounts[0]
      });
      const items = await searchOneDrive(response.accessToken, odSearch);
      setOdItems(items);
      setOdFolderId(undefined);
    } catch (e: any) {
      console.error(e);
      setOdError("Failed to search OneDrive: " + e.message);
    } finally {
      setOdLoading(false);
    }
  };

  const handleFileSelect = (item: any) => {
    setSelectedFile(item);
    setShareDocType("Shared Document");
    setShareDesc("");
    setSelectedEmpOids([]);
    setOneDriveStep("share");
    setOdError(null);
    getUsers().then(res => setAllEmployees(res.users || [])).catch(console.error);
  };

  const toggleEmp = (oid: string) => {
    setSelectedEmpOids(prev => prev.includes(oid) ? prev.filter(id => id !== oid) : [...prev, oid]);
  };

  const handleShare = async () => {
    setSubmitting(true);
    setOdError(null);
    try {
      if (!accounts[0]) throw new Error("No active Microsoft account found.");
      const response = await instance.acquireTokenSilent({
        scopes: ["Files.Read", "Files.ReadWrite"],
        account: accounts[0]
      });
      const link = await createShareLink(response.accessToken, selectedFile.id, selectedFile.webUrl);
      
      await shareDocument({
        fileName: selectedFile.name,
        onedriveUrl: link,
        driveItemId: selectedFile.id,
        documentType: shareDocType,
        description: shareDesc,
        recipientOids: selectedEmpOids
      });
      
      setShowOneDriveModal(false);
      fetchDocs();
    } catch (e: any) {
      console.error(e);
      setOdError("Failed to share document: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    setError(null);
    if (!form.title || !form.documentType || !form.onedriveUrl) { setError("Title, type and URL are required."); return; }
    if (form.scope === "individual" && !form.assignedEmployeeId) { setError("Assign Employee is required for individual documents."); return; }
    setSubmitting(true);
    try {
      const { document } = await createDocument({ ...form, assignedToOid: form.assignedEmployeeId || undefined });
      setDocuments(prev => [document, ...prev]);
      setForm({ title: "", description: "", documentType: "", scope: "company", onedriveUrl: "", assignedEmployeeId: "" });
      setEmployeeSearch("");
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


  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "Employee"}>
      <header className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">HR Documents</h1>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <div className="search-input-wrapper">
              <SearchIcon size={16} className="search-icon" />
              <input className="input" style={{ width: 220, paddingLeft: 36 }} placeholder="Search documents…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {isPrivileged && (
              <>
                <button className="btn btn--secondary" onClick={openOneDriveFlow}><HardDrive size={16} /> Share from OneDrive</button>
                <button className="btn btn--primary" onClick={() => setShowForm(v => !v)}><Plus size={16} /> Add Record</button>
              </>
            )}
          </div>
        </div>
      </header>

      {isPrivileged && showForm && (
        <div className="card animate-fade-in" style={{ marginBottom: "var(--space-4)" }}>
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
              <div className="form-field" style={{ position: "relative" }}>
                <label className="form-label">Assign Employee *</label>
                <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                  <SearchIcon size={16} style={{ position: "absolute", left: 12, color: "var(--neutral-400)", pointerEvents: "none", zIndex: 10 }} />
                  <input 
                    className="input employee-search-input" 
                    style={{ paddingLeft: 36, paddingRight: form.assignedEmployeeId ? 64 : 36, width: "100%", transition: "all 0.2s ease" }}
                    placeholder="Search employee name..." 
                    value={employeeSearch}
                    onFocus={() => {
                      setShowEmpDropdown(true);
                      if (allEmployees.length === 0) {
                        setEmployeesLoading(true);
                        getUsers().then(res => setAllEmployees(res.users || [])).catch(console.error).finally(() => setEmployeesLoading(false));
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowEmpDropdown(false), 200)}
                    onChange={e => {
                      setEmployeeSearch(e.target.value);
                      setShowEmpDropdown(true);
                      if (form.assignedEmployeeId) setForm(f => ({ ...f, assignedEmployeeId: "" }));
                    }}
                    onKeyDown={e => {
                      if (e.key === "Escape") setShowEmpDropdown(false);
                      if (e.key === "ArrowDown" && !showEmpDropdown) setShowEmpDropdown(true);
                    }}
                  />
                  <div style={{ position: "absolute", right: 12, display: "flex", alignItems: "center", gap: 4, zIndex: 10 }}>
                    {form.assignedEmployeeId && (
                       <button
                         type="button"
                         className="btn btn--ghost btn--sm"
                         style={{ padding: 4, height: 24, minWidth: 24, color: "var(--neutral-500)", background: "var(--neutral-100)" }}
                         onClick={() => {
                           setForm(f => ({ ...f, assignedEmployeeId: "" }));
                           setEmployeeSearch("");
                           setShowEmpDropdown(true);
                         }}
                         title="Clear selection"
                       >
                         <X size={14} />
                       </button>
                    )}
                    <ChevronLeft size={16} style={{ color: "var(--neutral-400)", transform: showEmpDropdown ? "rotate(90deg)" : "rotate(270deg)", transition: "transform 0.2s ease", pointerEvents: "none" }} />
                  </div>
                </div>
                
                {showEmpDropdown && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                    background: "white", border: "1px solid var(--neutral-200)",
                    borderRadius: "var(--rounded-md)", marginTop: 4,
                    boxShadow: "var(--shadow-lg)", maxHeight: 200, overflowY: "auto"
                  }}>
                    {employeesLoading ? (
                      <div style={{ padding: "var(--space-3)", textAlign: "center", color: "var(--neutral-500)", fontSize: "0.875rem" }}>
                        <Loader2 size={16} className="animate-spin" style={{ display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />
                        Loading employees...
                      </div>
                    ) : (
                      (() => {
                        const filteredEmps = allEmployees.filter(emp => emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) || emp.email.toLowerCase().includes(employeeSearch.toLowerCase()));
                        if (filteredEmps.length === 0) {
                          return <div style={{ padding: "var(--space-3)", textAlign: "center", color: "var(--neutral-500)", fontSize: "0.875rem" }}>No employees found</div>;
                        }
                        return filteredEmps.map(emp => (
                          <div 
                            key={emp.entra_oid}
                            style={{
                              padding: "var(--space-2) var(--space-3)", cursor: "pointer",
                              borderBottom: "1px solid var(--neutral-100)", display: "flex", alignItems: "center", gap: "var(--space-2)",
                              background: form.assignedEmployeeId === emp.entra_oid ? "var(--primary-50)" : "transparent"
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setForm(f => ({ ...f, assignedEmployeeId: emp.entra_oid }));
                              setEmployeeSearch(emp.name);
                              setShowEmpDropdown(false);
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--neutral-50)"}
                            onMouseLeave={e => e.currentTarget.style.background = form.assignedEmployeeId === emp.entra_oid ? "var(--primary-50)" : "transparent"}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: form.assignedEmployeeId === emp.entra_oid ? "white" : "var(--neutral-100)", border: form.assignedEmployeeId === emp.entra_oid ? "1px solid var(--primary-200)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8125rem", fontWeight: 700, color: form.assignedEmployeeId === emp.entra_oid ? "var(--primary-700)" : "var(--neutral-600)", flexShrink: 0 }}>
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--neutral-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name}</div>
                              <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.email}</div>
                            </div>
                            {form.assignedEmployeeId === emp.entra_oid && <Check size={16} color="var(--primary-600)" />}
                          </div>
                        ));
                      })()
                    )}
                  </div>
                )}
              </div>
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

      <div className={isPrivileged ? "main-content-wrapper" : "content-grid"} style={isPrivileged ? { minWidth: 0 } : { gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {loading ? (
          <div className="card" style={{ gridColumn: "1 / -1" }}><div className="card__body" style={{ textAlign: "center", padding: "var(--space-12)" }}><Loader2 size={32} className="animate-spin" style={{ margin: "0 auto var(--space-4)", color: "var(--neutral-400)" }} /><p style={{ color: "var(--neutral-500)" }}>Loading documents…</p></div></div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <div className="card__body" style={{ 
              textAlign: "center", 
              padding: "var(--space-16)", 
              color: "var(--neutral-500)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-4)"
            }}>
              <div style={{ 
                width: 64, 
                height: 64, 
                borderRadius: "50%", 
                background: "var(--neutral-100)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "var(--neutral-400)",
                marginBottom: "var(--space-2)"
              }}>
                <FileText size={32} />
              </div>
              <div style={{ maxWidth: 400 }}>
                <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--neutral-900)", margin: "0 0 var(--space-2)" }}>
                  No Documents Available
                </h3>
                <p style={{ fontSize: "0.875rem", color: "var(--neutral-500)", lineHeight: 1.5 }}>
                  {search 
                    ? `We couldn't find any documents matching "${search}". Try a different search term or clear the filter.`
                    : "There are no company-wide or individually shared documents available for your account at this time."}
                </p>
                {search && (
                  <button 
                    className="btn btn--secondary btn--sm" 
                    style={{ marginTop: "var(--space-4)" }}
                    onClick={() => setSearch("")}
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : isPrivileged ? (
          <div className="card documents-card" style={{ overflow: "hidden", minWidth: 0 }}>
            <div className="table-container responsive-table">
              <table className="table" style={{ tableLayout: "fixed", width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--neutral-50)", borderBottom: "1px solid var(--neutral-200)" }}>
                    <th style={{ width: "35%", padding: "var(--space-3) 0", paddingLeft: "var(--space-5)", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>File Name</th>
                    <th style={{ width: "15%", padding: "var(--space-3) 0", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Type</th>
                    <th style={{ width: "25%", padding: "var(--space-3) 0", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Shared With</th>
                    <th style={{ width: "12%", padding: "var(--space-3) 0", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Date</th>
                    <th style={{ width: "13%", padding: "var(--space-3) 0", paddingRight: "var(--space-5)", textAlign: "right", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody style={{ verticalAlign: "middle" }}>
                  {filtered.map(doc => {
                    return (
                      <tr key={doc.id} className="table-row-hover">
                        <td style={{ paddingLeft: "var(--space-5)", overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
                            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "8px", background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-600)" }}>
                              <FileText size={18} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, color: "var(--neutral-900)", fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={doc.title}>
                                {doc.title}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", textTransform: "capitalize" }}>{doc.scope} Access</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge--neutral" style={{ fontSize: "0.6875rem", fontWeight: 600 }}>{doc.document_type}</span>
                        </td>
                        <td style={{ overflow: "hidden" }}>
                          {doc.scope === "company" ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success-500)" }} />
                              <span style={{ fontSize: "0.8125rem", color: "var(--success-700)", fontWeight: 600 }}>Organizational</span>
                            </div>
                          ) : (
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--neutral-800)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={doc.assigned_to_name || "Unknown"}>
                                {doc.assigned_to_name || "Unknown"}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={doc.assigned_to_email || doc.assigned_to_oid}>
                                {doc.assigned_to_email || (doc.assigned_to_oid ? `ID: ${doc.assigned_to_oid.slice(0, 8)}...` : "—")}
                              </div>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: "0.8125rem", color: "var(--neutral-600)", fontWeight: 500 }}>
                          {new Date(doc.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td style={{ textAlign: "right", paddingRight: "var(--space-5)" }}>
                          <div style={{ display: "flex", gap: "var(--space-1)", justifyContent: "flex-end" }}>
                            <a href={doc.onedrive_url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm" title="View Source" style={{ width: 32, height: 32, padding: 0 }}>
                              <ExternalLink size={14} />
                            </a>
                            <button className="btn btn--ghost btn--sm" style={{ color: "var(--error-500)", width: 32, height: 32, padding: 0 }} onClick={() => handleDelete(doc.id)} title="Delete Record">
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
              {odError && (
                <div style={{ padding: "var(--space-3)", background: "#FEF2F2", color: "#B91C1C", fontSize: "0.875rem", borderBottom: "1px solid #FECACA" }}>
                  ⚠️ {odError}
                </div>
              )}
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
                  <div className="share-settings" style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
                    gap: "var(--space-5)", 
                    marginBottom: "var(--space-8)" 
                  }}>
                    <div className="form-field">
                      <label className="form-label" style={{ fontWeight: 600, color: "var(--neutral-700)" }}>Document Type</label>
                      <input className="input" placeholder="e.g. Employee Handbook" value={shareDocType} onChange={e => setShareDocType(e.target.value)} />
                    </div>
                    <div className="form-field">
                      <label className="form-label" style={{ fontWeight: 600, color: "var(--neutral-700)" }}>Description (Optional)</label>
                      <input className="input" placeholder="Briefly describe this document" value={shareDesc} onChange={e => setShareDesc(e.target.value)} />
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center", 
                    marginBottom: "var(--space-4)",
                    paddingBottom: "var(--space-2)",
                    borderBottom: "1px solid var(--neutral-100)"
                  }}>
                    <h4 style={{ fontSize: "0.9375rem", fontWeight: 700, margin: 0, color: "var(--neutral-800)" }}>
                      Select Employees 
                      <span style={{ marginLeft: "var(--space-2)", fontWeight: 500, color: "var(--neutral-500)", fontSize: "0.8125rem" }}>
                        ({selectedEmpOids.length} selected)
                      </span>
                    </h4>
                    {selectedEmpOids.length > 0 && (
                      <button className="btn btn--ghost btn--sm" style={{ height: 32, fontSize: "0.75rem", color: "var(--primary-600)" }} onClick={() => setSelectedEmpOids([])}>
                        Deselect All
                      </button>
                    )}
                  </div>
                  
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
                            <div className="emp-name" title={emp.name}>{emp.name}</div>
                            <div className="emp-email" title={emp.email}>{emp.email}</div>
                          </div>
                          <div className="emp-check">
                            {isSelected ? (
                              <CheckCircle size={20} fill="var(--primary-500)" color="white" />
                            ) : (
                              <div className="check-placeholder" />
                            )}
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
        
        .main-content-wrapper { 
          width: 100%; 
          overflow-x: hidden; 
          display: flex; 
          flex-direction: column;
        }

        .responsive-table {
          width: 100%;
          overflow-x: auto;
          scrollbar-width: thin;
          scrollbar-color: var(--neutral-200) transparent;
        }

        .responsive-table::-webkit-scrollbar { height: 6px; }
        .responsive-table::-webkit-scrollbar-track { background: transparent; }
        .responsive-table::-webkit-scrollbar-thumb { background-color: var(--neutral-200); border-radius: 10px; }

        .table-row-hover { 
          transition: background-color 0.2s ease;
        }
        .table-row-hover:hover { 
          background-color: var(--neutral-50); 
        }

        .table td {
          padding-top: var(--space-4);
          padding-bottom: var(--space-4);
          border-bottom: 1px solid var(--neutral-100);
        }

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
        .employee-selector-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); 
          gap: var(--space-4); 
          padding: 2px;
        }
        .employee-select-card { 
          display: flex; 
          align-items: center; 
          padding: var(--space-3); 
          border: 1px solid var(--neutral-200); 
          border-radius: var(--rounded-xl); 
          cursor: pointer; 
          transition: all 0.2s ease; 
          background: white;
          min-height: 64px;
          user-select: none;
        }
        .employee-select-card:hover { 
          border-color: var(--primary-400); 
          background: var(--neutral-50); 
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }
        .employee-select-card.selected { 
          border-color: var(--primary-500); 
          background: var(--primary-50); 
          box-shadow: 0 0 0 1px var(--primary-500); 
        }
        .emp-avatar { 
          width: 36px; 
          height: 36px; 
          border-radius: 10px; 
          background: var(--neutral-100); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 0.8125rem; 
          font-weight: 700; 
          color: var(--neutral-600); 
          margin-right: var(--space-3); 
          flex-shrink: 0;
          transition: all 0.2s;
        }
        .selected .emp-avatar { background: var(--primary-500); color: white; }
        .emp-info { flex: 1; min-width: 0; }
        .emp-name { 
          font-size: 0.875rem; 
          font-weight: 600; 
          color: var(--neutral-900); 
          white-space: nowrap; 
          overflow: hidden; 
          text-overflow: ellipsis; 
          margin-bottom: 2px;
        }
        .emp-email { 
          font-size: 0.75rem; 
          color: var(--neutral-500); 
          white-space: nowrap; 
          overflow: hidden; 
          text-overflow: ellipsis; 
        }
        .emp-check { 
          margin-left: var(--space-2); 
          color: var(--primary-500); 
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .check-placeholder { 
          width: 20px; 
          height: 20px; 
          border: 2px solid var(--neutral-200); 
          border-radius: 6px; 
          transition: all 0.2s;
        }
        .employee-select-card:hover .check-placeholder { border-color: var(--neutral-300); }
        
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </DashboardLayout>
  );
};

