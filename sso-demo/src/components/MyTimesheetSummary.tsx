import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { getMyTimesheet } from "../api/timesheets";
import type { Timesheet } from "../api/types";

const normalizeDate = (d: string | Date) => {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfBusinessWeek = (d: string | Date) => {
  const date = new Date(d);
  if (typeof d === "string" && d.length === 10) {
    const [y, m, day] = d.split("-").map(Number);
    date.setFullYear(y, m - 1, day);
    date.setHours(0, 0, 0, 0);
  }
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return normalizeDate(monday);
};

export const MyTimesheetSummary = ({ basePath }: { basePath: string }) => {
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWeek = async () => {
      try {
        const monday = startOfBusinessWeek(new Date());
        const d = await getMyTimesheet(monday);
        setTimesheet(d.timesheet);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadWeek();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "reviewed": return { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", icon: <CheckCircle size={12} /> };
      case "submitted": return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", icon: <Clock size={12} /> };
      case "rejected": return { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA", icon: <AlertCircle size={12} /> };
      default: return { bg: "#F3F4F6", text: "#374151", border: "#D1D5DB", icon: <FileText size={12} /> };
    }
  };

  const status = timesheet?.status || "draft";
  const hours = timesheet?.total_hours || 0;

  return (
    <div style={{
      background: "var(--neutral-0)",
      border: "1px solid var(--neutral-200)",
      borderRadius: "10px",
      boxShadow: "var(--shadow-sm)",
      overflow: "hidden",
      padding: "16px 20px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "20px"
    }}>
      <div>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--neutral-800)", margin: "0 0 4px 0" }}>
          My Timesheet (This Week)
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.6875rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: 600 }}>Total Hours</span>
            <span style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--neutral-900)" }}>{hours}h</span>
          </div>
          <div style={{ width: "1px", height: "24px", background: "var(--neutral-200)" }}></div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "0.6875rem", color: "var(--neutral-500)", textTransform: "uppercase", fontWeight: 600 }}>Status</span>
            <div style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "4px",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              marginTop: "2px",
              background: getStatusColor(status).bg,
              color: getStatusColor(status).text,
              border: `1px solid ${getStatusColor(status).border}`
            }}>
              {getStatusColor(status).icon}
              {status}
            </div>
          </div>
        </div>
      </div>
      
      <Link to={`${basePath}/my-timesheet`} className="btn btn--secondary" style={{ textDecoration: "none" }}>
        Manage My Timesheet
      </Link>
    </div>
  );
};
