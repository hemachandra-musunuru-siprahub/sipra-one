import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { Users, CheckSquare, Clock, CheckCircle, X } from "lucide-react";

import { TopAnnouncementsCarousel } from "./TopAnnouncementsCarousel";
import { getTeamLeave, actionLeave } from "../api/leave";
import { getTeamTimesheets, reviewTimesheet } from "../api/timesheets";
import { getTeamMembers } from "../api/users";
import type { LeaveRequest, Timesheet, User } from "../api/types";
import { formatDate, formatLeaveDates } from "../utils/dateFormatter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { internalUser: any; }

export const ManagerDashboard = ({ internalUser }: Props) => {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    Promise.all([getTeamLeave(), getTeamTimesheets(), getTeamMembers()])
      .then(([leaveData, tsData, membersData]) => {
        setLeaveRequests(leaveData.requests);
        setTimesheets(tsData.timesheets);
        setTeamMembers(membersData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const pendingLeave = leaveRequests.filter(r => r.status === "pending");
  const submittedTs = timesheets.filter(t => t.status === "submitted");
  const reviewedTs = timesheets.filter(t => t.status === "reviewed");

  const stats = [
    {
      label: "Pending Approvals",
      value: loading ? "—" : `${pendingLeave.length}`,
      sub: "Leave requests",
      icon: <CheckSquare size={16} />,
      color: "#CE2124",
      bg: "#FFF0F0",
    },
    {
      label: "Timesheets",
      value: loading ? "—" : `${submittedTs.length}`,
      sub: "Awaiting review",
      icon: <Clock size={16} />,
      color: "#3B82F6",
      bg: "#EFF6FF",
    },
    {
      label: "Reviewed",
      value: loading ? "—" : `${reviewedTs.length}`,
      sub: "This period",
      icon: <CheckCircle size={16} />,
      color: "#10B981",
      bg: "#ECFDF5",
    },
    {
      label: "Team Members",
      value: loading ? "—" : `${teamMembers.length}`,
      sub: "Direct reports",
      icon: <Users size={16} />,
      color: "#8B5CF6",
      bg: "#F5F3FF",
    },
  ];

  const handleApprove = async (id: string) => {
    try {
      const { request } = await actionLeave(id, "approved");
      setLeaveRequests(prev => prev.map(r => r.id === id ? request : r));
    } catch (e) { console.error(e); }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) return;
    try {
      const { request } = await actionLeave(id, "rejected", rejectReason);
      setLeaveRequests(prev => prev.map(r => r.id === id ? request : r));
      setRejectingId(null);
      setRejectReason("");
    } catch (e) { console.error(e); }
  };

  const handleReviewTs = async (id: string, status: "reviewed" | "draft") => {
    try {
      const { timesheet } = await reviewTimesheet(id, status);
      setTimesheets(prev => prev.map(t => t.id === id ? timesheet : t));
    } catch (e) { console.error(e); }
  };

  return (
    <DashboardLayout internalUser={internalUser} role="Manager">

      {/* ── Page Header ── */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "var(--neutral-400)",
          marginBottom: "6px",
          fontWeight: 500,
        }}>
          <span>Home</span>
          <span style={{ color: "var(--neutral-300)" }}>/</span>
          <span style={{ color: "var(--neutral-600)" }}>Dashboard</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{
            fontSize: "1.375rem",
            fontWeight: 700,
            color: "var(--neutral-900)",
            letterSpacing: "-0.02em",
          }}>
            Team Overview
          </h1>

        </div>
      </div>

  {/* ── Compact Hero Banner ── */ }
  < div style = {{
  background: "linear-gradient(120deg, var(--primary-700) 0%, var(--primary-500) 100%)",
    borderRadius: "12px",
      padding: "16px 24px",
        marginBottom: "20px",
          display: "flex",
            alignItems: "center",
              justifyContent: "space-between",
                position: "relative",
                  overflow: "hidden",
                    minHeight: "72px",
      }}>
  {/* Subtle decorative circles */ }
  < div style = {{
  position: "absolute", top: "-30px", right: "-30px",
    width: "120px", height: "120px",
      borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none",
        }} />
  < div style = {{
  position: "absolute", bottom: "-20px", right: "80px",
    width: "70px", height: "70px",
      borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none",
        }} />
  < div style = {{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.65)", fontWeight: 500, marginBottom: "2px" }}>
            Manager Dashboard
          </div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "white", margin: 0 }}>
            Welcome back, {internalUser?.name?.split(" ")[0] || "there"} 👋
          </h2>
        </div >
  <div style={{ position: "relative", zIndex: 1, textAlign: "right" }}>
    <div style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.55)", marginBottom: "2px", fontWeight: 500 }}>
      {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
    </div>
    <div style={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>
      {pendingLeave.length > 0 ? `${pendingLeave.length} approval${pendingLeave.length > 1 ? "s" : ""} pending` : "All caught up ✓"}
    </div>
  </div>
      </div >

  {/* ── KPI Cards ── */ }
  < div style = {{
  display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
      gap: "12px",
        marginBottom: "20px",
      }}>
{
  stats.map((s, i) => (
    <div
      key={i}
      style={{
        background: "var(--neutral-0)",
        border: "1px solid var(--neutral-200)",
        borderRadius: "10px",
        padding: "14px 16px",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--neutral-500)",
          letterSpacing: "0.01em",
        }}>
          {s.label}
        </span>
        <div style={{
          width: "26px", height: "26px",
          borderRadius: "6px",
          background: s.bg,
          color: s.color,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {s.icon}
        </div>
      </div>
      <div style={{
        fontSize: "1.75rem",
        fontWeight: 700,
        color: "var(--neutral-900)",
        lineHeight: 1,
        letterSpacing: "-0.03em",
      }}>
        {s.value}
      </div>
      <div style={{ fontSize: "0.6875rem", color: "var(--neutral-400)", fontWeight: 500 }}>
        {s.sub}
      </div>
    </div>
  ))
}
      </div >

  {/* ── Featured Announcements ── */ }
  < div style = {{ marginBottom: "20px" }}>
    <TopAnnouncementsCarousel />
      </div >

  {/* ── Tables ── */ }
  < div style = {{ display: "flex", flexDirection: "column", gap: "16px" }}>

    {/* Pending Leave Requests */ }
    < div style = {{
  background: "var(--neutral-0)",
    border: "1px solid var(--neutral-200)",
      borderRadius: "10px",
        boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--neutral-100)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)", margin: 0 }}>
                Pending Leave Requests
              </h3>
              {!loading && pendingLeave.length > 0 && (
                <span style={{
                  background: "var(--primary-50)",
                  color: "var(--primary-700)",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: "20px",
                }}>
                  {pendingLeave.length}
                </span>
              )}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  {["Employee", "Type", "Days", "Dates", "Status", "Actions"].map(h => (
                    <th key={h} style={{
                      background: "var(--neutral-50)",
                      padding: "8px 12px",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--neutral-400)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid var(--neutral-200)",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--neutral-400)", fontSize: "0.875rem" }}>Loading…</td></tr>
                ) : pendingLeave.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: "20px", textAlign: "center", color: "var(--neutral-400)", fontSize: "0.875rem" }}>No pending requests 🎉</td></tr>
                ) : pendingLeave.map(req => (
                  <tr key={req.id} style={{ borderBottom: "1px solid var(--neutral-100)" }}>
                    <td style={{ padding: "9px 12px", fontSize: "0.8125rem", color: "var(--neutral-700)", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {req.employee_name || req.employee_oid.slice(0, 8) + "…"}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{
                        background: "var(--primary-50)", color: "var(--primary-700)",
                        padding: "2px 8px", borderRadius: "20px",
                        fontSize: "0.6875rem", fontWeight: 600, textTransform: "capitalize",
                      }}>
                        {req.leave_type}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "0.8125rem", color: "var(--neutral-600)", fontWeight: 500 }}>
                      {req.total_days}d
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "0.8125rem", color: "var(--neutral-500)", whiteSpace: "nowrap" }}>
                      {formatLeaveDates(req.start_date, req.end_date)}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{
                        background: "#FFFBEB", color: "#B45309",
                        padding: "2px 8px", borderRadius: "20px",
                        fontSize: "0.6875rem", fontWeight: 600, textTransform: "capitalize",
                      }}>
                        {req.status}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          onClick={() => handleApprove(req.id)}
                          style={{
                            height: "26px", padding: "0 10px",
                            background: "var(--primary-500)", color: "white",
                            border: "none", borderRadius: "6px",
                            fontSize: "0.75rem", fontWeight: 600,
                            cursor: "pointer", whiteSpace: "nowrap",
                            transition: "background 150ms",
                          }}
                          onMouseOver={e => (e.currentTarget.style.background = "var(--primary-600)")}
                          onMouseOut={e => (e.currentTarget.style.background = "var(--primary-500)")}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectingId(req.id)}
                          style={{
                            height: "26px", padding: "0 10px",
                            background: "var(--neutral-0)", color: "var(--neutral-600)",
                            border: "1px solid var(--neutral-200)", borderRadius: "6px",
                            fontSize: "0.75rem", fontWeight: 600,
                            cursor: "pointer", whiteSpace: "nowrap",
                            transition: "all 150ms",
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = "var(--neutral-100)"; }}
                          onMouseOut={e => { e.currentTarget.style.background = "var(--neutral-0)"; }}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div >

  {/* Timesheet Review */ }
  < div style = {{
  background: "var(--neutral-0)",
    border: "1px solid var(--neutral-200)",
      borderRadius: "10px",
        boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--neutral-100)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)", margin: 0 }}>
                Timesheets Awaiting Review
              </h3>
              {!loading && submittedTs.length > 0 && (
                <span style={{
                  background: "#EFF6FF",
                  color: "#1D4ED8",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: "20px",
                }}>
                  {submittedTs.length}
                </span>
              )}
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  {["Employee", "Week Starting", "Total Hours", "Status", "Actions"].map(h => (
                    <th key={h} style={{
                      background: "var(--neutral-50)",
                      padding: "8px 12px",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--neutral-400)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "1px solid var(--neutral-200)",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "var(--neutral-400)", fontSize: "0.875rem" }}>Loading…</td></tr>
                ) : submittedTs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "var(--neutral-400)", fontSize: "0.875rem" }}>No timesheets awaiting review</td></tr>
                ) : submittedTs.map(ts => (
                  <tr key={ts.id} style={{ borderBottom: "1px solid var(--neutral-100)" }}>
                    <td style={{ padding: "9px 12px", fontSize: "0.8125rem", color: "var(--neutral-700)", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {ts.employee_name || ts.employee_oid.slice(0, 8) + "…"}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "0.8125rem", color: "var(--neutral-500)", whiteSpace: "nowrap" }}>
                      {formatDate(ts.week_start_date)}
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--neutral-800)" }}>
                        {ts.total_hours}h
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{
                        background: "#EFF6FF", color: "#1D4ED8",
                        padding: "2px 8px", borderRadius: "20px",
                        fontSize: "0.6875rem", fontWeight: 600, textTransform: "capitalize",
                      }}>
                        {ts.status}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px" }}>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          onClick={() => handleReviewTs(ts.id, "reviewed")}
                          style={{
                            height: "26px", padding: "0 10px",
                            background: "var(--primary-500)", color: "white",
                            border: "none", borderRadius: "6px",
                            fontSize: "0.75rem", fontWeight: 600,
                            cursor: "pointer", whiteSpace: "nowrap",
                          }}
                          onMouseOver={e => (e.currentTarget.style.background = "var(--primary-600)")}
                          onMouseOut={e => (e.currentTarget.style.background = "var(--primary-500)")}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReviewTs(ts.id, "draft")}
                          style={{
                            height: "26px", padding: "0 10px",
                            background: "var(--neutral-0)", color: "var(--neutral-600)",
                            border: "1px solid var(--neutral-200)", borderRadius: "6px",
                            fontSize: "0.75rem", fontWeight: 600,
                            cursor: "pointer", whiteSpace: "nowrap",
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = "var(--neutral-100)"; }}
                          onMouseOut={e => { e.currentTarget.style.background = "var(--neutral-0)"; }}
                        >
                          Send Back
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div >
      </div >

  {/* ── Reject Modal ── */ }
{
  rejectingId && (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.45)",
      zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(2px)",
    }}>
      <div style={{
        background: "white",
        borderRadius: "12px",
        width: 400,
        padding: "24px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--neutral-900)", margin: 0 }}>
            Rejection Reason
          </h3>
          <button
            onClick={() => { setRejectingId(null); setRejectReason(""); }}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--neutral-400)", padding: "4px",
              borderRadius: "4px", display: "flex",
            }}
          >
            <X size={16} />
          </button>
        </div>
        <textarea
          rows={3}
          placeholder="Enter a reason for rejection *"
          value={rejectReason}
          onChange={e => setRejectReason(e.target.value)}
          style={{
            width: "100%", resize: "vertical",
            border: "1px solid var(--neutral-200)",
            borderRadius: "8px", padding: "10px 12px",
            fontSize: "0.875rem", fontFamily: "inherit",
            color: "var(--neutral-700)",
            outline: "none",
            marginBottom: "16px",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button
            onClick={() => { setRejectingId(null); setRejectReason(""); }}
            style={{
              height: "34px", padding: "0 14px",
              background: "var(--neutral-0)",
              border: "1px solid var(--neutral-200)",
              borderRadius: "6px", cursor: "pointer",
              fontSize: "0.8125rem", fontWeight: 600, color: "var(--neutral-600)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => handleReject(rejectingId)}
            disabled={!rejectReason.trim()}
            style={{
              height: "34px", padding: "0 14px",
              background: !rejectReason.trim() ? "var(--neutral-200)" : "var(--primary-500)",
              border: "none", borderRadius: "6px", cursor: rejectReason.trim() ? "pointer" : "not-allowed",
              fontSize: "0.8125rem", fontWeight: 600,
              color: !rejectReason.trim() ? "var(--neutral-400)" : "white",
              transition: "all 150ms",
            }}
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  )
}
    </DashboardLayout >
  );
};
