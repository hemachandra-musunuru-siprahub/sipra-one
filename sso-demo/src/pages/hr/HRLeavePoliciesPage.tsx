import { useState, useEffect } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Plus, X, Users, Shield } from "lucide-react";
import {
  getLeavePolicies, createLeavePolicy, updateLeavePolicy, deleteLeavePolicy,
  assignPolicyToAll, assignPolicyToEmployees, getPolicyAssignments,
} from "../../api/leavePolicies";
import { getUsers } from "../../api/users";
import type { LeavePolicy, EmployeePolicyAssignment } from "../../api/types";

interface Props { internalUser: any; }

const EMPTY_FORM = {
  name: "", description: "", leave_type: "casual",
  monthly_credit: 1, carry_forward: true, expire_year_end: true,
};

export const HRLeavePoliciesPage = ({ internalUser }: Props) => {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [editPolicy, setEditPolicy] = useState<LeavePolicy | null>(null);
  const [policyForm, setPolicyForm] = useState({ ...EMPTY_FORM });
  const [policySubmitting, setPolicySubmitting] = useState(false);
  const [policyError, setPolicyError] = useState("");

  // Assign modal state
  const [assignTarget, setAssignTarget] = useState<LeavePolicy | null>(null);
  const [assignMode, setAssignMode] = useState<"all" | "selected">("all");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedOids, setSelectedOids] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<EmployeePolicyAssignment[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMsg, setAssignMsg] = useState("");

  const loadPolicies = () => {
    setPoliciesLoading(true);
    getLeavePolicies()
      .then(d => setPolicies(d.policies || []))
      .catch(() => setPolicies([]))
      .finally(() => setPoliciesLoading(false));
  };

  useEffect(() => {
    loadPolicies();
  }, []);

  const openCreate = () => {
    setEditPolicy(null);
    setPolicyForm({ ...EMPTY_FORM });
    setPolicyError("");
    setShowPolicyForm(true);
  };

  const openEdit = (p: LeavePolicy) => {
    setEditPolicy(p);
    setPolicyForm({
      name: p.name, description: p.description || "",
      leave_type: p.leave_type, monthly_credit: p.monthly_credit,
      carry_forward: p.carry_forward, expire_year_end: p.expire_year_end,
    });
    setPolicyError("");
    setShowPolicyForm(true);
  };

  const handlePolicySubmit = async () => {
    if (!policyForm.name.trim()) { setPolicyError("Policy name is required."); return; }
    if (!policyForm.monthly_credit || policyForm.monthly_credit <= 0) { setPolicyError("Monthly credit must be positive."); return; }
    setPolicySubmitting(true);
    setPolicyError("");
    try {
      if (editPolicy) {
        const { policy } = await updateLeavePolicy(editPolicy.id, policyForm);
        setPolicies(prev => prev.map(p => p.id === policy.id ? policy : p));
      } else {
        const { policy } = await createLeavePolicy(policyForm as any);
        setPolicies(prev => [policy, ...prev]);
      }
      setShowPolicyForm(false);
    } catch (e: any) {
      setPolicyError(e.message || "Failed to save policy.");
    } finally {
      setPolicySubmitting(false);
    }
  };

  const handleDeletePolicy = async (id: string) => {
    if (!window.confirm("Deactivate this policy?")) return;
    try {
      await deleteLeavePolicy(id);
      setPolicies(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const openAssign = async (p: LeavePolicy) => {
    setAssignTarget(p);
    setAssignMode("all");
    setSelectedOids([]);
    setAssignMsg("");
    setAssignLoading(true);
    try {
      const [usersData, assignData] = await Promise.all([
        getUsers(),
        getPolicyAssignments(p.id),
      ]);
      setAllUsers((usersData.users || []).filter((u: any) => u.role !== "Admin" && u.is_active));
      setAssignments(assignData.assignments || []);
    } catch {}
    setAssignLoading(false);
  };

  const handleAssignSubmit = async () => {
    if (!assignTarget) return;
    if (assignMode === "selected" && selectedOids.length === 0) { setAssignMsg("Select at least one employee."); return; }
    setAssignLoading(true);
    setAssignMsg("");
    try {
      const result = assignMode === "all"
        ? await assignPolicyToAll(assignTarget.id)
        : await assignPolicyToEmployees(assignTarget.id, selectedOids);
      setAssignMsg(result.message || "Assigned successfully.");
      loadPolicies();
      const assignData = await getPolicyAssignments(assignTarget.id);
      setAssignments(assignData.assignments || []);
    } catch (e: any) {
      setAssignMsg(e.message || "Assignment failed.");
    } finally {
      setAssignLoading(false);
    }
  };

  const toggleOid = (oid: string) =>
    setSelectedOids(prev => prev.includes(oid) ? prev.filter(x => x !== oid) : [...prev, oid]);

  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "HR"}>
      <header className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Leave Policies</h1>
        </div>
      </header>

      <div className="card">
        <div className="card__header">
          <h3 className="card__title">Leave Policies</h3>
          <button className="btn btn--primary" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.875rem" }} onClick={openCreate}>
            <Plus size={15} /> Create Policy
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Policy Name</th>
                <th>Leave Type</th>
                <th>Monthly Credit</th>
                <th>Carry Forward</th>
                <th>Expire Year-End</th>
                <th>Assigned To</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policiesLoading
                ? <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-500)" }}>Loading policies…</td></tr>
                : policies.length === 0
                  ? <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--neutral-500)" }}>No policies yet. Create one to get started.</td></tr>
                  : policies.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div>{p.name}</div>
                        {p.description && <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginTop: 2 }}>{p.description}</div>}
                      </td>
                      <td><span className="badge badge--hr" style={{ textTransform: "capitalize" }}>{p.leave_type}</span></td>
                      <td style={{ fontWeight: 700 }}>{Number(p.monthly_credit).toFixed(1)} <span style={{ fontSize: "0.7rem", color: "var(--neutral-400)", fontWeight: 400 }}>day/mo</span></td>
                      <td>
                        <span className={`badge ${p.carry_forward ? "badge--published" : "badge--draft"}`}>
                          {p.carry_forward ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${p.expire_year_end ? "badge--urgent" : "badge--published"}`}>
                          {p.expire_year_end ? "Expires Dec 31" : "No Expiry"}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.8125rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Users size={13} color="var(--neutral-400)" />
                          <span>{p.assigned_count ?? 0} employee{Number(p.assigned_count) !== 1 ? "s" : ""}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
                          <button className="btn btn--secondary" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => openAssign(p)}>
                            <Shield size={12} style={{ marginRight: 4 }} />Assign
                          </button>
                          <button className="btn btn--secondary" style={{ fontSize: "0.75rem", padding: "4px 10px" }} onClick={() => openEdit(p)}>Edit</button>
                          <button className="btn--icon btn--icon-danger" style={{ width: 28, height: 28 }} onClick={() => handleDeletePolicy(p.id)}>
                            <X size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create / Edit Policy Modal ─────────────────────────────────────────── */}
      {showPolicyForm && (
        <div className="modal-overlay" onClick={() => setShowPolicyForm(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">{editPolicy ? "Edit Policy" : "Create Leave Policy"}</div>
              <button className="topbar__icon-btn" onClick={() => setShowPolicyForm(false)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              {policyError && (
                <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid var(--error-300)", borderRadius: 6, padding: "8px 12px", fontSize: "0.8125rem", color: "var(--error-700)", marginBottom: "var(--space-3)" }}>
                  {policyError}
                </div>
              )}
              <div className="form-field--compact">
                <label className="form-label--compact">Policy Name <span style={{ color: "var(--error-500)" }}>*</span></label>
                <input className="form-input--compact" placeholder="e.g. Standard CL Policy" value={policyForm.name} onChange={e => setPolicyForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-field--compact">
                <label className="form-label--compact">Description (Optional)</label>
                <textarea className="form-textarea--compact" placeholder="Brief description…" rows={2} value={policyForm.description} onChange={e => setPolicyForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
                <div className="form-field--compact">
                  <label className="form-label--compact">Leave Type</label>
                  <select className="form-select--compact" value={policyForm.leave_type} onChange={e => setPolicyForm(f => ({ ...f, leave_type: e.target.value }))}>
                    <option value="casual">Casual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="annual">Annual Leave</option>
                  </select>
                </div>
                <div className="form-field--compact">
                  <label className="form-label--compact">Monthly Credit (days) <span style={{ color: "var(--error-500)" }}>*</span></label>
                  <input type="number" className="form-input--compact" min={0.5} max={31} step={0.5} value={policyForm.monthly_credit} onChange={e => setPolicyForm(f => ({ ...f, monthly_credit: parseFloat(e.target.value) || 1 }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)", marginTop: "var(--space-2)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8125rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={policyForm.carry_forward} onChange={e => setPolicyForm(f => ({ ...f, carry_forward: e.target.checked }))} />
                  Carry Forward Balance
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8125rem", cursor: "pointer" }}>
                  <input type="checkbox" checked={policyForm.expire_year_end} onChange={e => setPolicyForm(f => ({ ...f, expire_year_end: e.target.checked }))} />
                  Expire on Dec 31
                </label>
              </div>
            </div>
            <div className="modal__footer" style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <button className="btn btn--secondary" onClick={() => setShowPolicyForm(false)}>Cancel</button>
              <button className="btn btn--primary" onClick={handlePolicySubmit} disabled={policySubmitting}>
                {policySubmitting ? "Saving…" : editPolicy ? "Save Changes" : "Create Policy"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Policy Modal ────────────────────────────────────────────────── */}
      {assignTarget && (
        <div className="modal-overlay" onClick={() => setAssignTarget(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <div className="modal__title">Assign: {assignTarget.name}</div>
              <button className="topbar__icon-btn" onClick={() => setAssignTarget(null)}><X size={18} /></button>
            </div>
            <div className="modal__body">
              {/* Assignment mode radio */}
              <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
                {(["all", "selected"] as const).map(m => (
                  <label key={m} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.875rem", cursor: "pointer" }}>
                    <input type="radio" name="assignMode" checked={assignMode === m} onChange={() => setAssignMode(m)} />
                    {m === "all" ? "Assign to All Employees" : "Assign to Selected Employees"}
                  </label>
                ))}
              </div>

              {/* Employee multi-select */}
              {assignMode === "selected" && (
                <div style={{ border: "1px solid var(--neutral-200)", borderRadius: 6, maxHeight: 200, overflowY: "auto" }}>
                  {assignLoading
                    ? <div style={{ padding: 16, textAlign: "center", fontSize: "0.875rem", color: "var(--neutral-400)" }}>Loading…</div>
                    : allUsers.map(u => (
                      <label key={u.entra_oid} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--neutral-100)", cursor: "pointer", fontSize: "0.8125rem" }}>
                        <input type="checkbox" checked={selectedOids.includes(u.entra_oid)} onChange={() => toggleOid(u.entra_oid)} />
                        <div className="avatar avatar--sm" style={{ width: 22, height: 22, fontSize: "0.65rem" }}>{(u.name || "U")[0]}</div>
                        <span style={{ fontWeight: 500 }}>{u.name}</span>
                        <span style={{ color: "var(--neutral-400)", fontSize: "0.75rem" }}>{u.email}</span>
                      </label>
                    ))
                  }
                </div>
              )}

              {/* Current assignments summary */}
              {!assignLoading && assignments.length > 0 && (
                <div style={{ marginTop: "var(--space-4)", padding: "8px 12px", background: "var(--neutral-50)", borderRadius: 6, fontSize: "0.8125rem", color: "var(--neutral-600)" }}>
                  Currently assigned to <strong>{assignments.length}</strong> employee{assignments.length !== 1 ? "s" : ""}.
                </div>
              )}

              {assignMsg && (
                <div style={{ marginTop: "var(--space-3)", padding: "8px 12px", background: "var(--success-50, #f0fdf4)", border: "1px solid var(--success-200, #bbf7d0)", borderRadius: 6, fontSize: "0.8125rem", color: "var(--success-700, #15803d)" }}>
                  {assignMsg}
                </div>
              )}
            </div>
            <div className="modal__footer" style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end" }}>
              <button className="btn btn--secondary" onClick={() => setAssignTarget(null)}>Close</button>
              <button className="btn btn--primary" onClick={handleAssignSubmit} disabled={assignLoading}>
                {assignLoading ? "Assigning…" : "Assign Policy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};
