import React from "react";
import { DashboardLayout } from "./DashboardLayout";
import { TopAnnouncementsCarousel } from "./TopAnnouncementsCarousel";
import { MyTimesheetSummary } from "./MyTimesheetSummary";
import { TimesheetAnalyticsWidget } from "./TimesheetAnalyticsWidget";
import { getHRTimesheets } from "../api/timesheets";
import type { HRTimesheet } from "../api/timesheets";
import { useState, useEffect } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props { internalUser: any; }

export const HRDashboard = ({ internalUser }: Props) => {
  const [timesheets, setTimesheets] = useState<HRTimesheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHRTimesheets()
      .then(data => setTimesheets(data.timesheets))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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



      {/* ── Featured Announcements ── */}
      <div style={{ marginBottom: "20px" }}>
        <TopAnnouncementsCarousel />
      </div>

      {/* ── My Timesheet Summary ── */}
      <MyTimesheetSummary basePath="/hr" />

      {/* ── Organization Timesheet Analytics ── */}
      <TimesheetAnalyticsWidget timesheets={timesheets} title="Organization Timesheet Analytics" loading={loading} />

    </DashboardLayout>
  );
};
