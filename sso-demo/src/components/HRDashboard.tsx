import React, { useState, useEffect } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { useNavigate } from "react-router-dom";
import { Users, Calendar, FileText, Megaphone, ArrowRight } from "lucide-react";
import { getAllLeave } from "../api/leave";
import { getDocuments, getAllDocuments } from "../api/documents";
import { TopAnnouncementsCarousel } from "./TopAnnouncementsCarousel";
import { getAnnouncements } from "../api/announcements";
import type { LeaveRequest, HrDocument, Announcement } from "../api/types";
import { formatLeaveDates } from "../utils/dateFormatter";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { internalUser: any; }

export const HRDashboard = ({ internalUser }: Props) => {
  const navigate = useNavigate();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [documents, setDocuments] = useState<HrDocument[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAllLeave().catch(() => ({ requests: [] })),
      getAllDocuments().catch(() => ({ documents: [] })),
      getAnnouncements(1, 20).catch(() => ({ announcements: [] }))
    ])
      .then(([leaveData, docsData, annData]) => {
        setLeaveRequests(leaveData?.requests || []);
        setDocuments(docsData?.documents || []);
        setAnnouncements(annData?.announcements || []);
      })
      .catch(err => {
        console.error("HRDashboard: failed to fetch metrics", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const pendingLeave = leaveRequests.filter(r => r.status === "pending");
  const totalDocs = documents.length;
  const companyDocs = documents.filter(d => d.scope === "company");

  const stats = [
    {
      label: "Pending Leave",
      value: loading ? "—" : `${pendingLeave.length}`,
      sub: "Requires action",
      icon: <Calendar size={16} />,
      color: "#F59E0B",
      bg: "#FFFBEB",
    },
    {
      label: "Total Documents",
      value: loading ? "—" : `${totalDocs}`,
      sub: `${companyDocs.length} company-wide`,
      icon: <FileText size={16} />,
      color: "#3B82F6",
      bg: "#EFF6FF",
    },
    {
      label: "Announcements",
      value: loading ? "—" : `${announcements.length}`,
      sub: "Published",
      icon: <Megaphone size={16} />,
      color: "#10B981",
      bg: "#ECFDF5",
    },
    {
      label: "All Leave Requests",
      value: loading ? "—" : `${leaveRequests.length}`,
      sub: "Total records",
      icon: <Users size={16} />,
      color: "#CE2124",
      bg: "#FFF0F0",
    },
  ];

  const quickLinks = [
    { label: "Leave Requests", path: "/hr/leave-requests", color: "#F59E0B", bg: "#FFFBEB" },
    { label: "Documents", path: "/hr/documents", color: "#3B82F6", bg: "#EFF6FF" },
    { label: "Announcements", path: "/hr/announcements", color: "#10B981", bg: "#ECFDF5" },
    { label: "Employees", path: "/hr/employees", color: "#8B5CF6", bg: "#F5F3FF" },
    { label: "Timesheets", path: "/hr/timesheets", color: "#CE2124", bg: "#FFF0F0" },
    { label: "Performance", path: "/hr/performance", color: "#6B7280", bg: "#F9FAFB" },
  ];

  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "HR"}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{
            fontSize: "1.375rem", fontWeight: 700,
            color: "var(--neutral-900)", letterSpacing: "-0.02em",
          }}>
            People &amp; Culture
          </h1>

        </div>
      </div>

      {/* ── Compact Hero Banner ── */}
      <div style={{
        background: "linear-gradient(120deg, #8C1012 0%, #CE2124 100%)",
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
        <div style={{
          position: "absolute", top: "-30px", right: "-30px",
          width: "120px", height: "120px",
          borderRadius: "50%", background: "rgba(255,255,255,0.07)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-20px", right: "80px",
          width: "70px", height: "70px",
          borderRadius: "50%", background: "rgba(255,255,255,0.05)", pointerEvents: "none",
        }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "white", margin: 0 }}>
            Welcome back, {internalUser?.name?.split(" ")[0] || "there"} 👋
          </h2>
        </div>
        <div style={{ position: "relative", zIndex: 1, textAlign: "right" }}>
          <div style={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.55)", marginBottom: "2px", fontWeight: 500 }}>
            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "12px",
        marginBottom: "20px",
      }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: "var(--neutral-0)",
            border: "1px solid var(--neutral-200)",
            borderRadius: "10px",
            padding: "14px 16px",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--neutral-500)", letterSpacing: "0.01em" }}>
                {s.label}
              </span>
              <div style={{
                width: "26px", height: "26px", borderRadius: "6px",
                background: s.bg, color: s.color,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {s.icon}
              </div>
            </div>
            <div style={{
              fontSize: "1.75rem", fontWeight: 700,
              color: "var(--neutral-900)", lineHeight: 1, letterSpacing: "-0.03em",
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--neutral-400)", fontWeight: 500 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Featured Announcements ── */}
      <div style={{ marginBottom: "20px" }}>
        <TopAnnouncementsCarousel />
      </div>

      {/* ── Content Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "16px" }}>

        {/* Pending Leave Table */}
        <div style={{
          background: "var(--neutral-0)",
          border: "1px solid var(--neutral-200)",
          borderRadius: "10px",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--neutral-100)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)", margin: 0 }}>
                Pending Leave Requests
              </h3>
              {!loading && pendingLeave.length > 0 && (
                <span style={{
                  background: "#FFFBEB", color: "#B45309",
                  fontSize: "0.6875rem", fontWeight: 700,
                  padding: "2px 7px", borderRadius: "20px",
                }}>
                  {pendingLeave.length}
                </span>
              )}
            </div>
            <button
              onClick={() => navigate("/hr/leave-requests")}
              style={{
                display: "flex", alignItems: "center", gap: "4px",
                fontSize: "0.75rem", fontWeight: 600, color: "var(--primary-500)",
                background: "none", border: "none", cursor: "pointer",
              }}
            >
              View all <ArrowRight size={11} />
            </button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  {["Employee", "Type", "Dates", "Days", "Status"].map(h => (
                    <th key={h} style={{
                      background: "var(--neutral-50)",
                      padding: "8px 12px",
                      fontSize: "0.6875rem", fontWeight: 600,
                      color: "var(--neutral-400)",
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      borderBottom: "1px solid var(--neutral-200)",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "var(--neutral-400)", fontSize: "0.875rem" }}>Loading…</td></tr>
                ) : pendingLeave.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: "20px", textAlign: "center", color: "var(--neutral-400)", fontSize: "0.875rem" }}>No pending requests 🎉</td></tr>
                ) : pendingLeave.slice(0, 6).map((req) => (
                  <tr key={req.id} style={{ borderBottom: "1px solid var(--neutral-100)" }}>
                    <td style={{ padding: "9px 12px", fontSize: "0.8125rem", color: "var(--neutral-700)", fontWeight: 500 }}>
                      {req.employee_name || <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "var(--neutral-400)" }}>{req.employee_oid.slice(0, 8)}…</span>}
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
                    <td style={{ padding: "9px 12px", fontSize: "0.8125rem", color: "var(--neutral-500)", whiteSpace: "nowrap" }}>
                      {formatLeaveDates(req.start_date, req.end_date)}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "0.8125rem", color: "var(--neutral-600)", fontWeight: 500 }}>
                      {req.total_days}d
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Links sidebar panel */}
        <div style={{
          background: "var(--neutral-0)",
          border: "1px solid var(--neutral-200)",
          borderRadius: "10px",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--neutral-100)" }}>
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)", margin: 0 }}>
              HR Modules
            </h3>
          </div>
          <div style={{ padding: "10px" }}>
            {quickLinks.map((link, i) => (
              <button
                key={i}
                onClick={() => navigate(link.path)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "9px 10px",
                  borderRadius: "7px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 150ms",
                  marginBottom: "2px",
                }}
                onMouseOver={e => (e.currentTarget.style.background = "var(--neutral-50)")}
                onMouseOut={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--neutral-700)" }}>
                  {link.label}
                </span>
                <ArrowRight size={12} style={{ color: "var(--neutral-300)", flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Company Documents ── */}
      <div style={{
        marginTop: "16px",
        background: "var(--neutral-0)",
        border: "1px solid var(--neutral-200)",
        borderRadius: "10px",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
      }}>
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--neutral-100)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)", margin: 0 }}>
            Company Documents
          </h3>
          <button
            onClick={() => navigate("/hr/documents")}
            style={{
              display: "flex", alignItems: "center", gap: "4px",
              fontSize: "0.75rem", fontWeight: 600, color: "var(--primary-500)",
              background: "none", border: "none", cursor: "pointer",
            }}
          >
            View all <ArrowRight size={11} />
          </button>
        </div>
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {loading ? (
            <p style={{ color: "var(--neutral-400)", fontSize: "0.875rem", padding: "10px 0" }}>Loading…</p>
          ) : documents.length === 0 ? (
            <p style={{ color: "var(--neutral-400)", fontSize: "0.875rem", padding: "10px 0" }}>
              No documents yet. Add one from the HR Documents page.
            </p>
          ) : documents.slice(0, 4).map((doc) => (
            <div key={doc.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 10px",
              border: "1px solid var(--neutral-100)",
              borderRadius: "7px",
            }}>
              <div>
                <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--neutral-800)" }}>{doc.title}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--neutral-400)" }}>{doc.document_type}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{
                  background: doc.scope === "company" ? "#ECFDF5" : "var(--neutral-100)",
                  color: doc.scope === "company" ? "#047857" : "var(--neutral-500)",
                  padding: "2px 8px", borderRadius: "20px",
                  fontSize: "0.6875rem", fontWeight: 600,
                }}>
                  {doc.scope}
                </span>
                <a
                  href={doc.onedrive_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: "0.75rem", fontWeight: 600,
                    color: "var(--primary-500)",
                    textDecoration: "none",
                  }}
                >
                  Open
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

    </DashboardLayout>
  );
};
