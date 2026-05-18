import React, { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { 
  FileText, Plus, Trash2, ExternalLink, HardDrive, 
  Search as SearchIcon, Folder, File, CheckCircle, 
  ChevronLeft, X, Loader2, Users as UsersIcon,
  Check, Filter
} from "lucide-react";
import { 
  getDocuments, getAllDocuments, createDocument, deleteDocument,
  browseOneDrive, searchOneDrive, shareDocument, createShareLink,
  getDocumentTypes
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

  // Document Type Filter State
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showTypeFilter, setShowTypeFilter] = useState(false);

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
    const fetchPromise = isPrivileged ? getAllDocuments(selectedTypes) : getDocuments(selectedTypes);
    
    fetchPromise
      .then(d => setDocuments(d.documents))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isPrivileged, selectedTypes]);

  useEffect(() => {
    getDocumentTypes().then(res => setAvailableTypes(res.types)).catch(console.error);
  }, []);

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

            <div style={{ position: "relative" }}>
              <button 
                className="btn btn--secondary" 
                onClick={() => setShowTypeFilter(!showTypeFilter)}
                style={{ position: "relative" }}
              >
                <Filter size={16} /> 
                {selectedTypes.length > 0 ? "Types Filtered" : "Filter by Type"}
                {selectedTypes.length > 0 && (
                  <span style={{
                    position: "absolute", right: -6, top: -6,
                    background: "var(--primary-600)", color: "white",
                    borderRadius: "10px", padding: "2px 6px", fontSize: "0.625rem", fontWeight: "bold"
                  }}>
                    {selectedTypes.length}
                  </span>
                )}
              </button>
              
              {showTypeFilter && (
                <>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowTypeFilter(false)} />
                  <div style={{
                    position: "absolute", top: "100%", right: 0, marginTop: 4,
                    width: 200, background: "white", borderRadius: "var(--rounded-md)",
                    boxShadow: "var(--shadow-lg)", border: "1px solid var(--neutral-200)",
                    zIndex: 50, padding: "var(--space-2)"
                  }}>
                    {availableTypes.length === 0 ? (
                      <div style={{ padding: "var(--space-2)", fontSize: "0.875rem", color: "var(--neutral-500)", textAlign: "center" }}>No types available</div>
                    ) : (
                      <>
                        <div style={{ maxHeight: 200, overflowY: "auto" }}>
                          {availableTypes.map(type => (
                            <label key={type} style={{
                              display: "flex", alignItems: "center", gap: "var(--space-2)",
                              padding: "var(--space-2)", cursor: "pointer", borderRadius: "var(--rounded-sm)",
                              fontSize: "0.875rem"
                            }} onMouseEnter={e => e.currentTarget.style.background = "var(--neutral-50)"}
                               onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                              <input 
                                type="checkbox" 
                                checked={selectedTypes.includes(type)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTypes(prev => [...prev, type]);
                                  } else {
                                    setSelectedTypes(prev => prev.filter(t => t !== type));
                                  }
                                }}
                              />
                              <span style={{ textTransform: "capitalize" }}>{type}</span>
                            </label>
                          ))}
                        </div>
                        {selectedTypes.length > 0 && (
                          <div style={{ borderTop: "1px solid var(--neutral-100)", paddingTop: "var(--space-2)", marginTop: "var(--space-2)" }}>
                            <button 
                              className="btn btn--ghost btn--sm" 
                              style={{ width: "100%", fontSize: "0.75rem" }}
                              onClick={() => setSelectedTypes([])}
                            >
                              Clear Filter
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
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
                        const normalizedEmployees = allEmployees.map(emp => ({
                          id: emp.entra_oid,
                          name: emp.name,
                          role: emp.role || "Employee",
                          designation: emp.designation || "Software Engineer"
                        }));
                        const filteredEmps = normalizedEmployees.filter(emp => emp.name.toLowerCase().includes(employeeSearch.toLowerCase()));
                        if (filteredEmps.length === 0) {
                          return <div style={{ padding: "var(--space-3)", textAlign: "center", color: "var(--neutral-500)", fontSize: "0.875rem" }}>No employees found</div>;
                        }
                        return filteredEmps.map(emp => (
                          <div 
                            key={emp.id}
                            style={{
                              padding: "var(--space-2) var(--space-3)", cursor: "pointer",
                              borderBottom: "1px solid var(--neutral-100)", display: "flex", alignItems: "center", gap: "var(--space-2)",
                              background: form.assignedEmployeeId === emp.id ? "var(--primary-50)" : "transparent"
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setForm(f => ({ ...f, assignedEmployeeId: emp.id }));
                              setEmployeeSearch(emp.name);
                              setShowEmpDropdown(false);
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "var(--neutral-50)"}
                            onMouseLeave={e => e.currentTarget.style.background = form.assignedEmployeeId === emp.id ? "var(--primary-50)" : "transparent"}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: form.assignedEmployeeId === emp.id ? "white" : "var(--neutral-100)", border: form.assignedEmployeeId === emp.id ? "1px solid var(--primary-200)" : "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8125rem", fontWeight: 700, color: form.assignedEmployeeId === emp.id ? "var(--primary-700)" : "var(--neutral-600)", flexShrink: 0 }}>
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                                <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--neutral-900)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.name}</div>
                                <span className="badge badge--neutral" style={{ fontSize: "0.625rem", padding: "2px 6px" }}>{emp.role}</span>
                              </div>
                            </div>
                            {form.assignedEmployeeId === emp.id && <Check size={16} color="var(--primary-600)" />}
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
      )}      <div className="main-content-wrapper" style={{ minWidth: 0 }}>
        {loading ? (
          <div className="card documents-card" style={{ overflow: "hidden", minWidth: 0 }}>
            <div className="table-container responsive-table">
              <table className="table" style={{ tableLayout: "fixed", width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--neutral-50)", borderBottom: "1px solid var(--neutral-200)" }}>
                    <th style={{ width: "35%", padding: "var(--space-3) 0", paddingLeft: "var(--space-5)", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>File Name</th>
                    <th style={{ width: "15%", padding: "var(--space-3) 0", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Type</th>
                    <th style={{ width: "25%", padding: "var(--space-3) 0", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                      {isPrivileged ? "Shared With" : "Shared By"}
                    </th>
                    <th style={{ width: "12%", padding: "var(--space-3) 0", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Date</th>
                    <th style={{ width: "13%", padding: "var(--space-3) 0", paddingRight: "var(--space-5)", textAlign: "right", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map(i => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--neutral-100)" }}>
                      <td style={{ paddingLeft: "var(--space-5)", padding: "16px var(--space-5)" }}>
                        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--neutral-100)" }} className="skeleton-pulse" />
                          <div>
                            <div style={{ width: 120, height: 14, borderRadius: 4, background: "var(--neutral-100)", marginBottom: 6 }} className="skeleton-pulse" />
                            <div style={{ width: 80, height: 10, borderRadius: 4, background: "var(--neutral-50)" }} className="skeleton-pulse" />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "16px 0" }}><div style={{ width: 60, height: 20, borderRadius: 12, background: "var(--neutral-100)" }} className="skeleton-pulse" /></td>
                      <td style={{ padding: "16px 0" }}>
                        <div style={{ width: 100, height: 14, borderRadius: 4, background: "var(--neutral-100)", marginBottom: 6 }} className="skeleton-pulse" />
                        <div style={{ width: 140, height: 10, borderRadius: 4, background: "var(--neutral-50)" }} className="skeleton-pulse" />
                      </td>
                      <td style={{ padding: "16px 0" }}><div style={{ width: 70, height: 14, borderRadius: 4, background: "var(--neutral-100)" }} className="skeleton-pulse" /></td>
                      <td style={{ padding: "16px var(--space-5) 16px 0", textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                           <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--neutral-100)" }} className="skeleton-pulse" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                  {search ? "No documents found" : "No documents shared yet"}
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
        ) : (
          <div className="card documents-card" style={{ overflow: "hidden", minWidth: 0 }}>
            <div className="table-container responsive-table">
              <table className="table" style={{ tableLayout: "fixed", width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--neutral-50)", borderBottom: "1px solid var(--neutral-200)" }}>
                    <th style={{ width: "35%", padding: "var(--space-3) 0", paddingLeft: "var(--space-5)", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>File Name</th>
                    <th style={{ width: "15%", padding: "var(--space-3) 0", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Type</th>
                    <th style={{ width: "25%", padding: "var(--space-3) 0", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                      {isPrivileged ? "Shared With" : "Shared By"}
                    </th>
                    <th style={{ width: "12%", padding: "var(--space-3) 0", textAlign: "left", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Date</th>
                    <th style={{ width: "13%", padding: "var(--space-3) 0", paddingRight: "var(--space-5)", textAlign: "right", fontWeight: 600, color: "var(--neutral-600)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.02em" }}>Actions</th>
                  </tr>
                </thead>
                <tbody style={{ verticalAlign: "middle" }}>
                  {filtered.map(doc => {
                    return (
                      <tr key={doc.id} className="table-row-hover">
                        <td data-label="File Name" style={{ paddingLeft: "var(--space-5)", overflow: "hidden" }}>
                          <div className="flex-row-mobile-wrap" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
                            <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: "8px", background: "var(--primary-50)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-600)" }}>
                              <FileText size={18} />
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontWeight: 600, color: "var(--neutral-900)", fontSize: "0.875rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={doc.title}>
                                {doc.title}
                              </div>
                              <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", textTransform: "capitalize" }}>
                                {doc.scope === "company" ? "Shared Document" : "Individual Access"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td data-label="Type">
                          <span className="badge badge--neutral" style={{ fontSize: "0.6875rem", fontWeight: 600, textTransform: "capitalize" }}>{doc.document_type}</span>
                        </td>
                        <td data-label={isPrivileged ? "Shared With" : "Shared By"} style={{ overflow: "hidden" }}>
                          {isPrivileged ? (
                            doc.scope === "company" ? (
                              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success-500)" }} />
                                <span style={{ fontSize: "0.8125rem", color: "var(--success-700)", fontWeight: 600 }}>Organizational</span>
                              </div>
                            ) : (
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--neutral-800)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={doc.assigned_to_name || "Unknown"}>
                                  {doc.assigned_to_name || "Unknown"}
                                </div>
                                {doc.assigned_to_email && (
                                  <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={doc.assigned_to_email}>
                                    {doc.assigned_to_email}
                                  </div>
                                )}
                              </div>
                            )
                          ) : (
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--neutral-800)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={doc.shared_by_name || "HR Admin"}>
                                {doc.shared_by_name || "HR Admin"}
                              </div>
                              {doc.shared_by_email && (
                                <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={doc.shared_by_email}>
                                  {doc.shared_by_email}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td data-label="Date" style={{ fontSize: "0.8125rem", color: "var(--neutral-600)", fontWeight: 500 }}>
                          {new Date(doc.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                        </td>
                        <td data-label="Actions" style={{ textAlign: "right", paddingRight: "var(--space-5)" }}>
                          <div className="action-buttons-wrap" style={{ display: "flex", gap: "var(--space-1)", justifyContent: "flex-end" }}>
                            <a href={doc.onedrive_url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm" title="Open in OneDrive" style={{ width: 32, height: 32, padding: 0, color: "var(--primary-600)" }}>
                              <ExternalLink size={14} />
                            </a>
                            {isPrivileged && (
                              <button className="btn btn--ghost btn--sm" style={{ color: "var(--error-500)", width: 32, height: 32, padding: 0 }} onClick={() => handleDelete(doc.id)} title="Delete Record">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
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
                      const normalizedEmp = {
                        id: emp.entra_oid,
                        name: emp.name,
                        role: emp.role || "Employee",
                        designation: emp.designation || "Software Engineer"
                      };
                      return (
                        <div 
                          key={normalizedEmp.id} 
                          className={`employee-select-card ${isSelected ? "selected" : ""}`}
                          onClick={() => toggleEmp(normalizedEmp.id)}
                        >
                          <div className="emp-avatar">{normalizedEmp.name[0]}</div>
                          <div className="emp-info">
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "2px" }}>
                              <div className="emp-name" title={normalizedEmp.name} style={{ marginBottom: 0 }}>{normalizedEmp.name}</div>
                              <span className="badge badge--neutral" style={{ fontSize: "0.625rem", padding: "2px 6px" }}>{normalizedEmp.role}</span>
                            </div>
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
        .emp-role-desc { 
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

        @media (max-width: 768px) {
          .responsive-table table, .responsive-table thead, .responsive-table tbody, .responsive-table th, .responsive-table td, .responsive-table tr {
            display: block;
          }
          .responsive-table thead tr {
            position: absolute;
            top: -9999px;
            left: -9999px;
          }
          .responsive-table tr {
            border: 1px solid var(--neutral-200);
            border-radius: var(--rounded-lg);
            margin-bottom: var(--space-4);
            background: var(--neutral-0);
            box-shadow: var(--shadow-sm);
          }
          .responsive-table td {
            border: none;
            border-bottom: 1px solid var(--neutral-100);
            position: relative;
            padding-left: 40% !important;
            text-align: left !important;
            padding-top: var(--space-3) !important;
            padding-bottom: var(--space-3) !important;
            padding-right: var(--space-4) !important;
            display: flex;
            align-items: center;
          }
          .responsive-table td:last-child {
            border-bottom: none;
          }
          .responsive-table td::before {
            content: attr(data-label);
            position: absolute;
            left: var(--space-4);
            width: 35%;
            padding-right: 10px;
            white-space: nowrap;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--neutral-500);
            text-transform: uppercase;
          }
          .flex-row-mobile-wrap {
             align-items: flex-start !important;
          }
          .action-buttons-wrap {
             justify-content: flex-start !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
};

