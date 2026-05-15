import { createPortal } from "react-dom";
import type { Holiday } from "../../api/types";
import { HOLIDAY_TYPE_COLORS, HOLIDAY_TYPE_BG, HOLIDAY_TYPE_LABELS, isLongWeekend } from "../../api/holidays";
import { CalendarDays, RefreshCw, Users, Star, Zap } from "lucide-react";

interface HolidayPreviewCardProps {
  holiday: Holiday;
  x: number;
  y: number;
  onClose: () => void;
}

export const HolidayPreviewCard = ({ holiday, x, y }: HolidayPreviewCardProps) => {
  const color = HOLIDAY_TYPE_COLORS[holiday.holiday_type];
  const bg = HOLIDAY_TYPE_BG[holiday.holiday_type];
  const startFmt = new Date(holiday.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const endFmt   = new Date(holiday.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const sameDay  = holiday.start_date.slice(0, 10) === holiday.end_date.slice(0, 10);
  const longWknd = isLongWeekend(holiday);

  // Clamp to viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(x, window.innerWidth - 260),
    top: Math.min(y, window.innerHeight - 200),
    zIndex: 9999,
    width: 240,
    pointerEvents: "none",
  };

  return createPortal(
    <div className="hc-preview" style={style}>
      <div className="hc-preview__header" style={{ background: bg, borderLeft: `4px solid ${color}` }}>
        <div className="hc-preview__type-badge" style={{ background: color }}>
          {HOLIDAY_TYPE_LABELS[holiday.holiday_type]}
        </div>
        {holiday.status === "draft" && (
          <div className="hc-preview__status-badge">Draft</div>
        )}
      </div>
      <div className="hc-preview__body">
        <p className="hc-preview__title">{holiday.title}</p>
        <div className="hc-preview__meta">
          <CalendarDays size={12} />
          <span>{sameDay ? startFmt : `${startFmt} – ${endFmt}`}</span>
        </div>
        {holiday.description && (
          <p className="hc-preview__desc">{holiday.description}</p>
        )}
        <div className="hc-preview__tags">
          {holiday.is_optional && (
            <span className="hc-tag" style={{ background: "rgba(59,130,246,.1)", color: "#3B82F6" }}>
              <Star size={10} /> Optional
            </span>
          )}
          {holiday.is_recurring && (
            <span className="hc-tag" style={{ background: "rgba(16,185,129,.1)", color: "#10B981" }}>
              <RefreshCw size={10} /> Recurring
            </span>
          )}
          {longWknd && (
            <span className="hc-tag" style={{ background: "rgba(249,115,22,.1)", color: "#F97316" }}>
              <Zap size={10} /> Long Weekend
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
