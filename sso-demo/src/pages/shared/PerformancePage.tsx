import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Target, Star, Plus, CheckCircle, Clock, User, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { 
  getMyGoals, getTeamGoals, getAllGoals, createGoal, updateGoal,
  getMyReviews, getTeamReviews, getAllReviews, createReview, getEmployeeSummary,
  type Goal, type Review
} from "../../api/performance";

interface EmployeeSummary {
  employee_oid: string;
  employee_name: string;
  total_goals: number;
  completed_goals: number;
  in_progress_goals: number;
  not_started_goals: number;
  average_progress: number;
  goals: Goal[];
  reviews: Review[];
}

import { normalizeRole } from "../../lib/roleHelper";
import type { UserRole } from "../../lib/roleHelper";

interface Props { 
  internalUser: any; 
  role?: string; 
}

const CURRENT_REVIEW_PERIOD = "Q2 2026";

export const PerformancePage = ({ internalUser, role }: Props) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as "goals" | "reviews") || "goals";
  const [managerReviewSubTab, setManagerReviewSubTab] = useState<"pending" | "reviewed">("pending");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const setActiveTab = (tab: "goals" | "reviews") => {
    setSearchParams({ tab });
  };
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});

  // Forms
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [goalForm, setGoalForm] = useState({ title: "", description: "", target_date: "", employee_oid: "" });
  const [reviewForm, setReviewForm] = useState({ employee_oid: "", review_period: CURRENT_REVIEW_PERIOD, rating: 3, strengths: "", improvements: "", comments: "" });

  const currentRole = (role?.toLowerCase() || "employee") as "admin" | "hr" | "manager" | "employee";
  const layoutRole: UserRole = normalizeRole(role);

  useEffect(() => {
    loadData();
  }, [currentRole]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (currentRole === "employee") {
        const [g, r] = await Promise.all([getMyGoals(), getMyReviews()]);
        setGoals(g.goals);
        setReviews(r.reviews);
      } else if (currentRole === "manager") {
        const { summary: s } = await getEmployeeSummary();
        setSummary(s);
      } else {
        const [g, r] = await Promise.all([getAllGoals(), getAllReviews()]);
        setGoals(g.goals);
        setReviews(r.reviews);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleEmployee = (oid: string) => {
    setExpandedEmployees(prev => ({ ...prev, [oid]: !prev[oid] }));
  };

  const handleCreateGoal = async () => {
    if (!goalForm.title || !goalForm.target_date) return;
    setSubmitting(true);
    try {
      await createGoal(goalForm);
      setGoalForm({ title: "", description: "", target_date: "", employee_oid: "" });
      setShowGoalForm(false);
      loadData();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const handleUpdateGoalProgress = async (id: string, progress: number, currentStatus: string) => {
    let newStatus = currentStatus;
    if (progress === 100) newStatus = "completed";
    else if (progress > 0 && currentStatus === "not_started") newStatus = "in_progress";
    else if (progress === 0) newStatus = "not_started";

    try {
      await updateGoal(id, { progress_percent: progress, status: newStatus });
      loadData();
    } catch (e) { console.error(e); }
  };

  const handleCreateReview = async () => {
    if (!reviewForm.employee_oid || !reviewForm.review_period) return;
    setSubmitting(true);
    try {
      await createReview(reviewForm);
      setReviewForm({ employee_oid: "", review_period: CURRENT_REVIEW_PERIOD, rating: 3, strengths: "", improvements: "", comments: "" });
      setShowReviewForm(false);
      loadData();
      setManagerReviewSubTab("reviewed");
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const openReviewForm = (employeeOid: string) => {
    setReviewForm(f => ({ ...f, employee_oid: employeeOid }));
    setShowReviewForm(true);
    setShowGoalForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderGoalCard = (g: Goal, canUpdate = false) => (
    <div className="card" key={g.id} style={{ borderLeft: g.status === 'completed' ? '4px solid var(--success-500)' : '4px solid var(--primary-500)' }}>
      <div className="card__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 className="card__title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Target size={18} style={{ color: g.status === 'completed' ? 'var(--success-600)' : 'var(--primary-600)' }} />
            {g.title}
          </h3>
          <div style={{ fontSize: "0.875rem", color: "var(--neutral-500)", marginTop: "var(--space-1)" }}>
            {currentRole !== "employee" && currentRole !== "manager" && g.employee_name && <span style={{ marginRight: "var(--space-3)" }}><strong>Employee:</strong> {g.employee_name}</span>}
            <Clock size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
            Target: {new Date(g.target_date).toLocaleDateString()}
          </div>
        </div>
        <span className={`badge ${g.status === 'completed' ? 'badge--success' : 'badge--primary'}`}>{g.status.replace('_', ' ')}</span>
      </div>
      <div className="card__body">
        <p style={{ fontSize: "0.9375rem", color: "var(--neutral-700)", marginBottom: "var(--space-4)" }}>{g.description}</p>
        
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{ flex: 1, background: "var(--neutral-200)", height: 8, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${g.progress_percent}%`, background: g.status === 'completed' ? 'var(--success-500)' : 'var(--primary-500)', height: "100%" }} />
          </div>
          <span style={{ fontSize: "0.875rem", fontWeight: 600, width: 40 }}>{g.progress_percent}%</span>
        </div>
        
        {canUpdate && (
          <div style={{ marginTop: "var(--space-3)", display: "flex", gap: "var(--space-2)" }}>
            <button className="btn btn--sm btn--secondary" onClick={() => handleUpdateGoalProgress(g.id, Math.min(100, g.progress_percent + 10), g.status)}>+10%</button>
            <button className="btn btn--sm btn--secondary" onClick={() => handleUpdateGoalProgress(g.id, Math.max(0, g.progress_percent - 10), g.status)}>-10%</button>
            {g.progress_percent < 100 && (
              <button className="btn btn--sm btn--primary" onClick={() => handleUpdateGoalProgress(g.id, 100, g.status)}>
                <CheckCircle size={14} /> Mark Complete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderReviewCard = (r: Review) => (
    <div className="card" key={r.id}>
      <div className="card__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 className="card__title" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <Star size={18} style={{ color: "var(--dept-finance)" }} />
            {r.review_period} Review
          </h3>
          <div style={{ fontSize: "0.875rem", color: "var(--neutral-500)", marginTop: "var(--space-1)" }}>
            {currentRole !== "employee" && currentRole !== "manager" && r.employee_name && <span style={{ marginRight: "var(--space-3)" }}><strong>Employee:</strong> {r.employee_name}</span>}
            <span><strong>Reviewer:</strong> {r.reviewer_name || "Manager"}</span>
            <span style={{ marginLeft: "var(--space-3)" }}><strong>Date:</strong> {new Date(r.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {[1,2,3,4,5].map(star => (
            <Star key={star} size={16} fill={star <= r.rating ? "var(--dept-finance)" : "none"} color={star <= r.rating ? "var(--dept-finance)" : "var(--neutral-300)"} />
          ))}
        </div>
      </div>
      <div className="card__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        {r.strengths && (
          <div>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-900)", marginBottom: "var(--space-1)" }}>Strengths</h4>
            <p style={{ fontSize: "0.875rem", color: "var(--neutral-600)" }}>{r.strengths}</p>
          </div>
        )}
        {r.improvements && (
          <div>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-900)", marginBottom: "var(--space-1)" }}>Areas for Improvement</h4>
            <p style={{ fontSize: "0.875rem", color: "var(--neutral-600)" }}>{r.improvements}</p>
          </div>
        )}
        {r.comments && (
          <div style={{ gridColumn: "span 2" }}>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-900)", marginBottom: "var(--space-1)" }}>Comments</h4>
            <p style={{ fontSize: "0.875rem", color: "var(--neutral-600)" }}>{r.comments}</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderSummaryStats = (s: EmployeeSummary) => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-4)", background: "var(--neutral-50)", padding: "var(--space-4)", borderRadius: "var(--rounded-lg)" }}>
      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginBottom: "var(--space-1)" }}>Total Goals</div>
        <div style={{ fontSize: "1.125rem", fontWeight: 700 }}>{s.total_goals}</div>
      </div>
      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginBottom: "var(--space-1)" }}>Completed</div>
        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--success-600)" }}>{s.completed_goals}</div>
      </div>
      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginBottom: "var(--space-1)" }}>In Progress</div>
        <div style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--primary-600)" }}>{s.in_progress_goals}</div>
      </div>
      <div>
        <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", marginBottom: "var(--space-1)" }}>Avg Progress</div>
        <div style={{ fontSize: "1.125rem", fontWeight: 700 }}>{s.average_progress}%</div>
      </div>
    </div>
  );

  const filteredSummary = currentRole === "manager" && activeTab === "reviews" 
    ? summary.filter(s => {
        const hasCurrentReview = s.reviews.some(r => r.review_period === CURRENT_REVIEW_PERIOD);
        if (managerReviewSubTab === "pending") {
          return s.completed_goals > 0 && !hasCurrentReview;
        } else {
          return hasCurrentReview;
        }
      })
    : summary;

  return (
    <DashboardLayout internalUser={internalUser} role={displayRole}>
      <header className="page-header">
        <div className="breadcrumb">
          <span>{displayRole}</span><span className="breadcrumb__separator">/</span><span>Performance</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 className="page-title">Performance Management</h1>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            {currentRole !== "employee" && (
              <button className="btn btn--primary" onClick={() => { setShowGoalForm(true); setShowReviewForm(false); }}>
                <Plus size={16} /> Add Goal
              </button>
            )}
            {currentRole !== "employee" && (
              <button className="btn btn--secondary" onClick={() => { setShowReviewForm(true); setShowGoalForm(false); }}>
                <Star size={16} /> New Review
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Tabs */}
      <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-6)", borderBottom: "1px solid var(--neutral-200)", paddingBottom: "var(--space-2)" }}>
        <button 
          onClick={() => setActiveTab("goals")}
          style={{ 
            background: "none", border: "none", fontSize: "1rem", fontWeight: 600, padding: "var(--space-2) var(--space-4)", cursor: "pointer",
            color: activeTab === "goals" ? "var(--primary-600)" : "var(--neutral-500)",
            borderBottom: activeTab === "goals" ? "2px solid var(--primary-600)" : "none"
          }}
        >
          {currentRole === "employee" ? "My Goals" : currentRole === "manager" ? "Employee Goals" : "All Goals"}
        </button>
        <button 
          onClick={() => setActiveTab("reviews")}
          style={{ 
            background: "none", border: "none", fontSize: "1rem", fontWeight: 600, padding: "var(--space-2) var(--space-4)", cursor: "pointer",
            color: activeTab === "reviews" ? "var(--primary-600)" : "var(--neutral-500)",
            borderBottom: activeTab === "reviews" ? "2px solid var(--primary-600)" : "none"
          }}
        >
          {currentRole === "employee" ? "My Reviews" : currentRole === "manager" ? "Employee Review" : "All Reviews"}
        </button>
      </div>

      {/* Sub Tabs for Manager Reviews */}
      {currentRole === "manager" && activeTab === "reviews" && (
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <button 
            className={`btn btn--sm ${managerReviewSubTab === "pending" ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setManagerReviewSubTab("pending")}
          >
            Pending Review
          </button>
          <button 
            className={`btn btn--sm ${managerReviewSubTab === "reviewed" ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setManagerReviewSubTab("reviewed")}
          >
            Reviewed
          </button>
        </div>
      )}

      {/* Goal Form */}
      {showGoalForm && currentRole !== "employee" && (
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="card__header"><h3 className="card__title">Create New Goal</h3></div>
          <div className="card__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Title *</label>
              <input className="input" value={goalForm.title} onChange={e => setGoalForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Employee OID (Leave empty for self)</label>
              <input className="input" placeholder="Entra OID" value={goalForm.employee_oid} onChange={e => setGoalForm(f => ({ ...f, employee_oid: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Target Date *</label>
              <input className="input" type="date" value={goalForm.target_date} onChange={e => setGoalForm(f => ({ ...f, target_date: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Description</label>
              <textarea className="input" rows={3} value={goalForm.description} onChange={e => setGoalForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="card__footer" style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--primary" onClick={handleCreateGoal} disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
            <button className="btn btn--secondary" onClick={() => setShowGoalForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Review Form */}
      {showReviewForm && currentRole !== "employee" && (
        <div className="card" style={{ marginBottom: "var(--space-6)" }}>
          <div className="card__header"><h3 className="card__title">Add Performance Review</h3></div>
          <div className="card__body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Employee OID *</label>
              <input className="input" placeholder="Entra OID" value={reviewForm.employee_oid} onChange={e => setReviewForm(f => ({ ...f, employee_oid: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Review Period *</label>
              <input className="input" placeholder="e.g. Q1 2026, FY 2025" value={reviewForm.review_period} onChange={e => setReviewForm(f => ({ ...f, review_period: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Rating (1-5) *</label>
              <input className="input" type="number" min="1" max="5" value={reviewForm.rating} onChange={e => setReviewForm(f => ({ ...f, rating: parseInt(e.target.value) }))} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Strengths</label>
              <textarea className="input" rows={2} value={reviewForm.strengths} onChange={e => setReviewForm(f => ({ ...f, strengths: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>Areas for Improvement</label>
              <textarea className="input" rows={2} value={reviewForm.improvements} onChange={e => setReviewForm(f => ({ ...f, improvements: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ fontSize: "0.875rem", fontWeight: 500, display: "block", marginBottom: "var(--space-2)" }}>General Comments</label>
              <textarea className="input" rows={2} value={reviewForm.comments} onChange={e => setReviewForm(f => ({ ...f, comments: e.target.value }))} />
            </div>
          </div>
          <div className="card__footer" style={{ display: "flex", gap: "var(--space-3)" }}>
            <button className="btn btn--primary" onClick={handleCreateReview} disabled={submitting}>{submitting ? "Saving…" : "Save"}</button>
            <button className="btn btn--secondary" onClick={() => setShowReviewForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: "var(--space-6)", textAlign: "center", color: "var(--neutral-500)" }}>Loading data...</div>
      ) : currentRole === "manager" ? (
        // Manager Unified View
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {filteredSummary.length === 0 ? (
            <div className="card">
              <div className="card__body" style={{ textAlign: "center", color: "var(--neutral-500)", padding: "var(--space-8)" }}>
                <AlertCircle size={48} style={{ margin: "0 auto var(--space-4)", display: "block", opacity: 0.2 }} />
                {activeTab === "goals" 
                  ? "No team members found with goals." 
                  : managerReviewSubTab === "pending" 
                    ? "No employees currently pending review. Great job!" 
                    : "No reviews completed for this period yet."}
              </div>
            </div>
          ) : filteredSummary.map(s => (
            <div key={s.employee_oid} className="card" style={{ overflow: "visible" }}>
              <div 
                className="card__header" 
                style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                onClick={() => toggleEmployee(s.employee_oid)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <div className="avatar" style={{ width: 40, height: 40, background: "var(--primary-100)", color: "var(--primary-700)" }}>
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="card__title" style={{ margin: 0 }}>{s.employee_name}</h3>
                    <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{s.employee_oid}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                   {activeTab === "reviews" && managerReviewSubTab === "pending" && (
                     <button className="btn btn--primary btn--sm" onClick={(e) => { e.stopPropagation(); openReviewForm(s.employee_oid); }}>
                       <Plus size={14} /> Add Review
                     </button>
                   )}
                   {expandedEmployees[s.employee_oid] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
              
              <div className="card__body">
                {renderSummaryStats(s)}
                
                {expandedEmployees[s.employee_oid] && (
                  <div style={{ marginTop: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-4)", padding: "var(--space-4)", borderTop: "1px solid var(--neutral-100)" }}>
                    {activeTab === "goals" ? (
                      <>
                        <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Employee Goals</h4>
                        {s.goals.map(g => renderGoalCard(g))}
                      </>
                    ) : (
                      <>
                        <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-500)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {managerReviewSubTab === "pending" ? "Completed Goals to Review" : "Current Period Review"}
                        </h4>
                        {managerReviewSubTab === "pending" ? (
                           s.goals.filter(g => g.status === 'completed').map(g => renderGoalCard(g))
                        ) : (
                           s.reviews.filter(r => r.review_period === CURRENT_REVIEW_PERIOD).map(r => renderReviewCard(r))
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === "goals" ? (
        <div className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
          {goals.length === 0 ? (
             <div className="card"><div className="card__body" style={{ textAlign: "center", color: "var(--neutral-500)" }}>No goals found.</div></div>
          ) : goals.map(g => renderGoalCard(g, currentRole === "employee"))}
        </div>
      ) : (
        <div className="content-grid" style={{ gridTemplateColumns: "1fr" }}>
          {reviews.length === 0 ? (
             <div className="card"><div className="card__body" style={{ textAlign: "center", color: "var(--neutral-500)" }}>No reviews found.</div></div>
          ) : reviews.map(r => renderReviewCard(r))}
        </div>
      )}

    </DashboardLayout>
  );
};


