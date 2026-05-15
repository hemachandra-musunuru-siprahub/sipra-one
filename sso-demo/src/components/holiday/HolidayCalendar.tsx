import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Holiday } from "../../api/types";
import {
  HOLIDAY_TYPE_COLORS, HOLIDAY_TYPE_BG, HOLIDAY_TYPE_LABELS,
  getDatesInRange, isLongWeekend,
} from "../../api/holidays";
import { HolidayPreviewCard } from "./HolidayPreviewCard";

interface HolidayCalendarProps {
  holidays: Holiday[];
  year: number;
  month: number; // 0-indexed
  onMonthChange: (year: number, month: number) => void;
  onDateClick: (date: string) => void;
  onHolidayClick: (holiday: Holiday) => void;
  canEdit?: boolean;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export const HolidayCalendar = ({
  holidays, year, month, onMonthChange,
  onDateClick, onHolidayClick, canEdit = false,
}: HolidayCalendarProps) => {
  const [hovered, setHovered] = useState<{ holiday: Holiday; x: number; y: number } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Build a map: dateStr → holidays[]
  const dateMap = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    for (const h of holidays) {
      for (const d of getDatesInRange(h.start_date.slice(0, 10), h.end_date.slice(0, 10))) {
        if (!map[d]) map[d] = [];
        map[d].push(h);
      }
    }
    return map;
  }, [holidays]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const days: { date: string; isCurrentMonth: boolean }[] = [];

    // Prev month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      days.push({ date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        isCurrentMonth: true,
      });
    }

    // Next month fill to complete grid
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      days.push({ date: `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`, isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  const prevMonth = () => {
    if (month === 0) onMonthChange(year - 1, 11);
    else onMonthChange(year, month - 1);
  };

  const nextMonth = () => {
    if (month === 11) onMonthChange(year + 1, 0);
    else onMonthChange(year, month + 1);
  };

  return (
    <div className="hc-cal">
      {/* Month navigation */}
      <div className="hc-cal__nav">
        <button className="hc-cal__nav-btn" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <h3 className="hc-cal__month-title">
          {MONTH_NAMES[month]} {year}
        </h3>
        <button className="hc-cal__nav-btn" onClick={nextMonth} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="hc-cal__weekdays">
        {WEEKDAYS.map(wd => (
          <div
            key={wd}
            className={`hc-cal__weekday${wd === "Sun" || wd === "Sat" ? " hc-cal__weekday--weekend" : ""}`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="hc-cal__grid">
        {calendarDays.map(({ date, isCurrentMonth }) => {
          const dow = new Date(date).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isToday = date === today;
          const dayHolidays = dateMap[date] || [];

          return (
            <div
              key={date}
              className={[
                "hc-cal__day",
                !isCurrentMonth ? "hc-cal__day--other" : "",
                isWeekend ? "hc-cal__day--weekend" : "",
                isToday ? "hc-cal__day--today" : "",
                dayHolidays.length > 0 ? "hc-cal__day--has-holiday" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => canEdit && isCurrentMonth && onDateClick(date)}
              title={canEdit && isCurrentMonth ? "Click to add holiday" : undefined}
            >
              <span className="hc-cal__day-num">
                {parseInt(date.slice(8, 10))}
              </span>

              {/* Holiday pills */}
              <div className="hc-cal__events">
                {dayHolidays.slice(0, 2).map(h => {
                  const isFirstDay = h.start_date.slice(0, 10) === date;
                  const isLastDay = h.end_date.slice(0, 10) === date;
                  const longWknd = isLongWeekend(h);
                  return (
                    <div
                      key={h.id}
                      className={[
                        "hc-cal__event",
                        isFirstDay ? "hc-cal__event--start" : "",
                        isLastDay ? "hc-cal__event--end" : "",
                      ].filter(Boolean).join(" ")}
                      style={{
                        background: HOLIDAY_TYPE_COLORS[h.holiday_type],
                        opacity: h.status === "draft" ? 0.6 : 1,
                      }}
                      onClick={e => { e.stopPropagation(); onHolidayClick(h); }}
                      onMouseEnter={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setHovered({ holiday: h, x: rect.left, y: rect.bottom + 8 });
                      }}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {isFirstDay && (
                        <span className="hc-cal__event-label">
                          {longWknd && <span className="hc-lw-dot" title="Long weekend" />}
                          {h.title}
                        </span>
                      )}
                    </div>
                  );
                })}
                {dayHolidays.length > 2 && (
                  <span className="hc-cal__more">+{dayHolidays.length - 2} more</span>
                )}
              </div>

              {/* Add icon on hover for admin */}
              {canEdit && isCurrentMonth && (
                <div className="hc-cal__day-add">
                  <Plus size={12} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="hc-cal__legend">
        {(["mandatory","optional","festival","regional","company"] as const).map(t => (
          <span key={t} className="hc-legend-item">
            <span className="hc-legend-dot" style={{ background: HOLIDAY_TYPE_COLORS[t] }} />
            {HOLIDAY_TYPE_LABELS[t]}
          </span>
        ))}
        <span className="hc-legend-item">
          <span className="hc-legend-dot hc-legend-dot--draft" />
          Draft
        </span>
      </div>

      {/* Preview Card */}
      {hovered && (
        <HolidayPreviewCard
          holiday={hovered.holiday}
          x={hovered.x}
          y={hovered.y}
          onClose={() => setHovered(null)}
        />
      )}
    </div>
  );
};
