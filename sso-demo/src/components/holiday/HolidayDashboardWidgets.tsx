import type { HolidayStats } from "../../api/types";
import { CalendarDays, TrendingUp, Zap, Star } from "lucide-react";

interface HolidayDashboardWidgetsProps {
  stats?: HolidayStats;
  isLoading?: boolean;
}

export const HolidayDashboardWidgets = ({ stats, isLoading }: HolidayDashboardWidgetsProps) => {
  const widgets = [
    {
      label: "Total Published",
      value: stats ? Number(stats.total_published) : 0,
      icon: <CalendarDays size={20} />,
      color: "#CE2124",
      bg: "rgba(206,33,36,.10)",
      sub: `${stats ? Number(stats.total_days) : 0} Holiday Days`,
    },
    {
      label: "Upcoming",
      value: stats ? Number(stats.upcoming_count) : 0,
      icon: <TrendingUp size={20} />,
      color: "#3B82F6",
      bg: "rgba(59,130,246,.10)",
      sub: `${stats ? Number(stats.upcoming_days) : 0} Days ahead`,
    },
    {
      label: "Total Events",
      value: stats ? (Number(stats.total_published) + Number(stats.total_draft) + Number(stats.total_archived)) : 0,
      icon: <Zap size={20} />,
      color: "#F97316",
      bg: "rgba(249,115,22,.10)",
      sub: `${stats ? Number(stats.total_draft) : 0} Drafts / ${stats ? Number(stats.total_archived) : 0} Arch`,
    },
    {
      label: "Optional Holidays",
      value: stats ? Number(stats.optional_count) : 0,
      icon: <Star size={20} />,
      color: "#8B5CF6",
      bg: "rgba(139,92,246,.10)",
      sub: "Employee choice",
    },

  ];

  if (isLoading) {
    return (
      <div className="stats-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="hc-skeleton" style={{ height: 80 }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="stats-grid">
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
