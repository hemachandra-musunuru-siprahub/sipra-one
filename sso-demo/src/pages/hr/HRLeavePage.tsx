import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Calendar, Search, ShieldCheck, PlusCircle, CheckCircle, HelpCircle } from "lucide-react";
import { getAllLeave, getPolicies, createPolicy } from "../../api/leave";
import type { LeavePolicy } from "../../api/leave";
import { getUsers } from "../../api/users";
import type { LeaveRequest, User } from "../../api/types";

interface Props { internalUser: any; }

export const HRLeavePage = ({ internalUser }: Props) => {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"requests" | "policies">(
    searchParams.get("tab") === "policies" ? "policies" : "requests"
  );

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "policies") setActiveTab("policies");
    else setActiveTab("requests");
  }, [searchParams]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Requests Tab State
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // Policies Tab State (Form)
  const [policyName, setPolicyName] = useState("");
  const [policyType, setPolicyType] = useState<"annual" | "sick" | "casual" | "unpaid" | "other">("annual");
  const [policyDays, setPolicyDays] = useState(10);
  const [policyScope, setPolicyScope] = useState<"all" | "department" | "individual">("all");
  const [policyTarget, setPolicyTarget] = useState("");
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([getAllLeave(), getPolicies(), getUsers()])
      .then(([leaveData, policyData, userData]) => {
        setRequests(leaveData.requests || []);
        setPolicies(policyData.policies || []);
        setUsers(userData.users || []);
      })
      .catch(e => {
        console.error(e);
        setErrorMsg(e.message || "Failed to load leave data");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!policyName.trim()) {
      setErrorMsg("Policy name is required.");
      return;
    }

    if (policyScope === "individual" && !policyTarget) {
      setErrorMsg("Please select an employee.");
      return;
    }

    setSavingPolicy(true);
    try {
      const res = await createPolicy({
        name: policyName,
        leaveType: policyType,
        totalDays: policyDays,
        scope: policyScope,
        target: policyScope === "individual" ? policyTarget : null,
      });

      setPolicies(prev => [res.policy, ...prev]);
      setSuccessMsg(`Policy "${policyName}" created and leave balances applied successfully.`);
      
      // Reset form
      setPolicyName("");
      setPolicyDays(10);
      setPolicyScope("all");
      setPolicyTarget("");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to save policy.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchesSearch = (r.employee_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filter === "all" ? true : r.status === filter;
    return matchesSearch && matchesStatus;
  });

  const roles = internalUser?.roles || [];
  const isAdminRole = roles.includes("Admin") || roles.includes("SipraHub-SystemAdmin");
  const displayRole = isAdminRole ? "Admin" : "HR";

  return (
    <DashboardLayout internalUser={internalUser} role={displayRole}>
      <header className="page-header">
        <div className="breadcrumb">
          <span>HR</span><span className="breadcrumb__separator">/</span><span>Leave Management</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Leave Administration</h1>
        </div>
      </header>

      {errorMsg && (
        <div className="card" style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "var(--error-500)", marginBottom: "var(--space-4)" }}>
          <div className="card__body" style={{ color: "var(--error-600)", padding: "var(--space-4)", display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <HelpCircle size={20} /> <strong>Error:</strong> {errorMsg}
          </div>
        </div>
      )}

      {successMsg && (
        <div className="card" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "var(--success-500)", marginBottom: "var(--space-4)" }}>
          <div className="card__body" style={{ color: "var(--success-600)", padding: "var(--space-4)", display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
            <CheckCircle size={20} /> <strong>Success:</strong> {successMsg}
          </div>
        </div>
      )}

      {activeTab === "requests" ? (
        <div className="card">
          <div className="card__header">
            <h3 className="card__title"><Calendar size={18} style={{ marginRight: "var(--space-2)" }} /> Employee Requests</h3>
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              <div className="topbar__search" style={{ border: "1px solid var(--neutral-200)", borderRadius: "var(--rounded-md)", padding: "0 var(--space-3)" }}>
                <Search size={16} color="var(--neutral-400)" />
                <input className="topbar__search-input" placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="input" style={{ width: 150 }} value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th>Manager (OID)</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading leave data…</td></tr>
                  : filteredRequests.length === 0 ? <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No leave requests found.</td></tr>
                  : filteredRequests.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                          <div className="avatar avatar--sm" style={{ width: 24, height: 24 }}>{(r.employee_name || "E")[0]}</div>
                          <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>{r.employee_name || r.employee_oid.slice(0,8)}</span>
                        </div>
                      </td>
                      <td><span className="badge badge--hr" style={{ textTransform: "capitalize" }}>{r.leave_type} Leave</span></td>
                      <td style={{ fontSize: "0.875rem" }}>{r.start_date} → {r.end_date}</td>
                      <td>{r.total_days}</td>
                      <td>
                        <span className={`badge ${r.status === "approved" ? "badge--published" : r.status === "rejected" ? "badge--urgent" : r.status === "cancelled" ? "badge--it" : "badge--draft"}`}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.75rem", fontFamily: "monospace", color: "var(--neutral-500)" }}>
                        {r.manager_oid ? r.manager_oid.slice(0, 12) + "…" : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="content-grid">
          {/* Create Policy Form */}
          <div className="card" style={{ gridColumn: "span 4" }}>
            <div className="card__header"><h3 className="card__title"><PlusCircle size={18} /> Create New Policy</h3></div>
            <form onSubmit={handleCreatePolicy} className="card__body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-700)", marginBottom: "var(--space-1)" }}>Policy Name *</label>
                <input className="input" type="text" placeholder="e.g. Standard Annual Leave" value={policyName} onChange={e => setPolicyName(e.target.value)} required />
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-700)", marginBottom: "var(--space-1)" }}>Leave Type *</label>
                  <select className="input" value={policyType} onChange={e => setPolicyType(e.target.value as any)}>
                    <option value="annual">Annual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="casual">Casual Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-700)", marginBottom: "var(--space-1)" }}>Total Allowed Days *</label>
                  <input className="input" type="number" min={0} max={365} value={policyDays} onChange={e => setPolicyDays(Number(e.target.value))} required />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-700)", marginBottom: "var(--space-1)" }}>Policy Scope *</label>
                <select className="input" value={policyScope} onChange={e => setPolicyScope(e.target.value as any)}>
                  <option value="all">Apply to All Employees</option>
                  <option value="department">Apply to Department (Global Fallback)</option>
                  <option value="individual">Assign to Specific Employee</option>
                </select>
              </div>

              {policyScope === "individual" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-700)", marginBottom: "var(--space-1)" }}>Select Employee *</label>
                  <select className="input" value={policyTarget} onChange={e => setPolicyTarget(e.target.value)}>
                    <option value="">-- Choose Employee --</option>
                    {users.map(u => (
                      <option key={u.entra_oid} value={u.entra_oid}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
              )}

              <button className="btn btn--primary" type="submit" disabled={savingPolicy} style={{ marginTop: "var(--space-2)", justifyContent: "center" }}>
                {savingPolicy ? "Saving & Updating..." : "Create & Assign Policy"}
              </button>
            </form>
          </div>

          {/* Active Policies List */}
          <div className="card" style={{ gridColumn: "span 8" }}>
            <div className="card__header"><h3 className="card__title"><ShieldCheck size={18} /> Configured Leave Policies</h3></div>
            <div className="table-container">
              <table>
                <thead><tr><th>Policy Name</th><th>Leave Type</th><th>Allowed Days</th><th>Target Scope</th><th>Created At</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading policies…</td></tr>
                    : policies.length === 0 ? <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No policies defined. Fill out the form to create your first policy.</td></tr>
                    : policies.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600, color: "var(--neutral-800)" }}>{p.name}</td>
                        <td><span className="badge badge--hr" style={{ textTransform: "capitalize" }}>{p.leave_type} Leave</span></td>
                        <td style={{ fontWeight: 700 }}>{p.total_days} Days</td>
                        <td>
                          {p.scope === "all" ? (
                            <span className="badge badge--published">Company Wide</span>
                          ) : p.scope === "individual" ? (
                            <span className="badge badge--urgent">Individual</span>
                          ) : (
                            <span className="badge badge--it">Department</span>
                          )}
                        </td>
                        <td style={{ fontSize: "0.875rem", color: "var(--neutral-500)" }}>{new Date(p.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="card__footer">
              <p style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
                Policies act as structural templates. Overriding an existing policy will recalculate allowances.
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
