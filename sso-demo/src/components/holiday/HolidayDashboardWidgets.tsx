import type { HolidayStats } from "../../api/types";
import { CalendarDays, TrendingUp, Zap, Star } from "lucide-react";

interface HolidayDashboardWidgetsProps {
  stats?: HolidayStats;
  isLoading?: boolean;
}

export const HolidayDashboardWidgets = ({ stats, isLoading }: HolidayDashboardWidgetsProps) => {
  const widgets = [
    {
      label: "Total Holidays",
      value: stats ? Number(stats.total_published) : 0,
      icon: <CalendarDays size={20} />,
      color: "#CE2124",
      bg: "rgba(206,33,36,.10)",
      sub: "Published this year",
    },
    {
      label: "Non-working Days",
      value: stats ? Number(stats.total_days) : 0,
      icon: <Zap size={20} />,
      color: "#F97316",
      bg: "rgba(249,115,22,.10)",
      sub: "Cumulative total",
    },
    {
      label: "Upcoming Quarter",
      value: stats ? Number(stats.upcoming_quarter_count) : 0,
      icon: <TrendingUp size={20} />,
      color: "#3B82F6",
      bg: "rgba(59,130,246,.10)",
      sub: "Next 90 days",
    },
    {
      label: "Optional Days",
      value: stats ? Number(stats.optional_count) : 0,
      icon: <Star size={20} />,
      color: "#8B5CF6",
      bg: "rgba(139,92,246,.10)",
      sub: "Employee choice",
    },
    {
      label: "Regional Holidays",
      value: stats ? Number(stats.regional_count) : 0,
      icon: <CalendarDays size={20} />,
      color: "#10B981",
      bg: "rgba(16,185,129,.10)",
      sub: "Location specific",
    },
    {
      label: "Remaining",
      value: stats ? Number(stats.upcoming_count) : 0,
      icon: <TrendingUp size={20} />,
      color: "#F43F5E",
      bg: "rgba(244,63,94,.10)",
      sub: "Left in " + (stats ? (new Date().getFullYear()) : ""),
    },
  ];


  if (isLoading) {
    return (
      <div className="stats-grid stats-grid--6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="hc-skeleton" style={{ height: 80 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="stats-grid stats-grid--6">
      {widgets.map((w, i) => (
        <div key={i} className="stat-card" style={{ gap: "var(--space-3)" }}>
          <div className="stat-card__header">
            <span className="stat-card__label">{w.label}</span>
            <div className="stat-card__icon" style={{ background: w.bg }}>
              <span style={{ color: w.color }}>{w.icon}</span>
            </div>
          </div>
          <div className="stat-card__value" style={{ color: w.color, fontSize: "1.75rem" }}>
            {w.value}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>{w.sub}</div>
        </div>
      ))}
    </div>
  );
};
