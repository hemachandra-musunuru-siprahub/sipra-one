import React, { useMemo, useState } from "react";
import { CheckCircle, Clock, AlertCircle, Users, Calendar } from "lucide-react";
import type { Timesheet } from "../api/types";
import type { HRTimesheet } from "../api/timesheets";

interface Props {
  timesheets: (Timesheet | HRTimesheet)[];
  title?: string;
  loading?: boolean;
}

export const TimesheetAnalyticsWidget = ({ timesheets, title = "Timesheet Analytics", loading = false }: Props) => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const filteredTimesheets = useMemo(() => {
    return timesheets.filter(ts => {
      // Very simple filter by month (YYYY-MM prefix matching)
      return ts.week_start_date.startsWith(selectedMonth);
    });
  }, [timesheets, selectedMonth]);

  const stats = useMemo(() => {
    let totalHours = 0;
    let submitted = 0;
    let approved = 0;
    let pendingReviews = 0;

    filteredTimesheets.forEach(ts => {
      totalHours += Number(ts.total_hours) || 0;
      if (ts.status === "submitted") {
        submitted++;
        pendingReviews++;
      } else if (ts.status === "reviewed") {
        submitted++;
        approved++;
      }
    });

    return { totalHours, submitted, approved, pendingReviews };
  }, [filteredTimesheets]);

  const topContributors = useMemo(() => {
    const map: Record<string, { name: string, hours: number }> = {};
    filteredTimesheets.forEach(ts => {
      const empName = ts.employee_name || "Unknown";
      if (!map[empName]) map[empName] = { name: empName, hours: 0 };
      map[empName].hours += Number(ts.total_hours) || 0;
    });
    return Object.values(map).sort((a, b) => b.hours - a.hours).slice(0, 5);
  }, [filteredTimesheets]);

  return (
    <div style={{
      background: "var(--neutral-0)",
      border: "1px solid var(--neutral-200)",
      borderRadius: "10px",
      boxShadow: "var(--shadow-sm)",
      overflow: "hidden",
      marginBottom: "20px"
    }}>
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--neutral-100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--neutral-900)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <Calendar size={18} /> {title}
        </h3>
        <div>
          <input 
            type="month" 
            className="input" 
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ height: "32px", fontSize: "0.8125rem", padding: "0 10px" }}
          />
        </div>
      </div>

      <div style={{ padding: "20px", display: "flex", gap: "24px", flexWrap: "wrap" }}>
        
        {/* KPIs */}
        <div style={{ flex: "1 1 100%", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          <div style={{ background: "var(--neutral-50)", padding: "16px", borderRadius: "8px", border: "1px solid var(--neutral-100)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Clock size={14} /> Total Hours
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--neutral-900)" }}>
              {loading ? "..." : stats.totalHours.toFixed(1)}h
            </div>
          </div>
          
          <div style={{ background: "var(--neutral-50)", padding: "16px", borderRadius: "8px", border: "1px solid var(--neutral-100)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Users size={14} /> Timesheets Submitted
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--primary-600)" }}>
              {loading ? "..." : stats.submitted}
            </div>
          </div>

          <div style={{ background: "var(--neutral-50)", padding: "16px", borderRadius: "8px", border: "1px solid var(--neutral-100)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <AlertCircle size={14} /> Pending Reviews
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#D97706" }}>
              {loading ? "..." : stats.pendingReviews}
            </div>
          </div>

          <div style={{ background: "var(--neutral-50)", padding: "16px", borderRadius: "8px", border: "1px solid var(--neutral-100)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)", fontWeight: 600, textTransform: "uppercase", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle size={14} /> Approved
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "#059669" }}>
              {loading ? "..." : stats.approved}
            </div>
          </div>
        </div>

        {/* Charts/Visualizers (Simple CSS bars) */}
        {!loading && topContributors.length > 0 && (
          <div style={{ flex: "1 1 100%", marginTop: "16px" }}>
            <h4 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)", marginBottom: "16px" }}>Top Contributors (Hours)</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {topContributors.map((c, i) => {
                const max = topContributors[0].hours;
                const pct = max > 0 ? (c.hours / max) * 100 : 0;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "120px", fontSize: "0.8125rem", color: "var(--neutral-700)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.name}
                    </div>
                    <div style={{ flex: 1, background: "var(--neutral-100)", height: "8px", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: "var(--primary-500)", borderRadius: "4px" }} />
                    </div>
                    <div style={{ width: "40px", textAlign: "right", fontSize: "0.8125rem", fontWeight: 700, color: "var(--neutral-900)" }}>
                      {c.hours}h
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && filteredTimesheets.length === 0 && (
          <div style={{ flex: "1 1 100%", textAlign: "center", padding: "32px", color: "var(--neutral-400)", fontSize: "0.875rem" }}>
            No timesheet data available for {selectedMonth}.
          </div>
        )}
      </div>
    </div>
  );
};
