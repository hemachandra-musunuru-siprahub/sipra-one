import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { Holiday } from "../../api/types";
import { HOLIDAY_TYPE_COLORS, HOLIDAY_TYPE_BG, HOLIDAY_TYPE_LABELS, isLongWeekend } from "../../api/holidays";
import { CalendarDays, RefreshCw, Star, Zap } from "lucide-react";

interface HolidayPreviewCardProps {
  holiday: Holiday;
  x: number;
  y: number;
  onClose: () => void;
}

const HolidayPreviewCard = ({ holiday, x, y }: HolidayPreviewCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y, opacity: 0, transform: "scale(0.95)" });

  const color = HOLIDAY_TYPE_COLORS[holiday.holiday_type];
  const bg = HOLIDAY_TYPE_BG[holiday.holiday_type];
  
  const formatUTC = (dateStr: string) => {
    const d = new Date(`${dateStr.slice(0, 10)}T12:00:00Z`);
    return d.toLocaleDateString("en-IN", { 
      day: "numeric", 
      month: "short", 
      year: "numeric",
      timeZone: "UTC"
    });
  };

  const startFmt = formatUTC(holiday.start_date);
  const endFmt   = formatUTC(holiday.end_date);
  const sameDay  = holiday.start_date.slice(0, 10) === holiday.end_date.slice(0, 10);
  const longWknd = isLongWeekend(holiday);

  useEffect(() => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const { width, height } = card.getBoundingClientRect();
    
    let left = x;
    let top = y;

    if (left + width > window.innerWidth - 20) {
      left = window.innerWidth - width - 20;
    }
    if (left < 20) left = 20;

    if (top + height > window.innerHeight - 20) {
      top = y - height - 16;
    }

    setPos({ left, top, opacity: 1, transform: "scale(1)" });
  }, [x, y, holiday.id]);

  return createPortal(
    <div 
      ref={cardRef}
      className="hc-preview" 
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        zIndex: 99999,
        width: 260,
        pointerEvents: "none",
        opacity: pos.opacity,
        transform: pos.transform,
        transition: "opacity 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
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

export default HolidayPreviewCard;
