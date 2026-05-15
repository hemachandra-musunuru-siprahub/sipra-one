import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Holiday } from "../../api/types";
import {
  HOLIDAY_TYPE_COLORS, HOLIDAY_TYPE_BG, HOLIDAY_TYPE_LABELS,
  getDatesInRange, isLongWeekend,
} from "../../api/holidays";
import HolidayPreviewCard from "./HolidayPreview.tsx";

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

  // Build a lane-aware map: dateStr → { holiday, lane, isStart, isEnd, isMiddle }[]
  const processedData = useMemo(() => {
    const sortedHolidays = [...holidays].sort((a, b) => {
      const startA = a.start_date.slice(0, 10);
      const startB = b.start_date.slice(0, 10);
      if (startA !== startB) return startA.localeCompare(startB);
      // Longer holidays first to optimize packing
      const durA = new Date(`${a.end_date}T12:00:00Z`).getTime() - new Date(`${a.start_date}T12:00:00Z`).getTime();
      const durB = new Date(`${b.end_date}T12:00:00Z`).getTime() - new Date(`${b.start_date}T12:00:00Z`).getTime();
      return durB - durA;
    });

    const holidayLanes: Record<string, number> = {}; // holidayId -> lane
    const dateLanes: Record<string, Set<number>> = {}; // date -> occupiedLanes

    for (const h of sortedHolidays) {
      const dates = getDatesInRange(h.start_date.slice(0, 10), h.end_date.slice(0, 10));
      let lane = 0;
      while (true) {
        const isFree = dates.every(d => !dateLanes[d]?.has(lane));
        if (isFree) break;
        lane++;
      }
      
      holidayLanes[h.id] = lane;
      dates.forEach(d => {
        if (!dateLanes[d]) dateLanes[d] = new Set();
        dateLanes[d].add(lane);
      });
    }

    const dateMap: Record<string, { holiday: Holiday; lane: number; type: "start" | "middle" | "end" | "single" }[]> = {};
    for (const h of sortedHolidays) {
      const dates = getDatesInRange(h.start_date.slice(0, 10), h.end_date.slice(0, 10));
      const lane = holidayLanes[h.id];

      dates.forEach((d, idx) => {
        if (!dateMap[d]) dateMap[d] = [];
        let type: "start" | "middle" | "end" | "single" = "middle";
        if (dates.length === 1) type = "single";
        else if (idx === 0) type = "start";
        else if (idx === dates.length - 1) type = "end";

        dateMap[d].push({ holiday: h, lane, type });
      });
    }

    // For each date, sort by lane and add spacers if needed
    const finalMap: Record<string, ({ holiday: Holiday; type: string } | null)[]> = {};
    Object.entries(dateMap).forEach(([d, items]) => {
      const maxLane = Math.max(...items.map(i => i.lane));
      const lanes: ({ holiday: Holiday; type: string } | null)[] = new Array(maxLane + 1).fill(null);
      items.forEach(item => {
        lanes[item.lane] = { holiday: item.holiday, type: item.type };
      });
      finalMap[d] = lanes;
    });

    return finalMap;
  }, [holidays]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(Date.UTC(year, month, 1, 12, 0, 0)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0)).getUTCDate();
    const prevMonthDays = new Date(Date.UTC(year, month, 0, 12, 0, 0)).getUTCDate();
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
          const dayDate = new Date(`${date}T12:00:00Z`);
          const dow = dayDate.getUTCDay();
          const isWeekend = dow === 0 || dow === 6;
          const isToday = date === today;
          const daySlots = processedData[date] || [];
          const hasHolidays = daySlots.some(s => !!s);

          return (
            <div
              key={date}
              className={[
                "hc-cal__day",
                !isCurrentMonth ? "hc-cal__day--other" : "",
                isWeekend ? "hc-cal__day--weekend" : "",
                isToday ? "hc-cal__day--today" : "",
                hasHolidays ? "hc-cal__day--has-holiday" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => canEdit && isCurrentMonth && onDateClick(date)}
              title={canEdit && isCurrentMonth ? "Click to add holiday" : undefined}
            >
              <span className="hc-cal__day-num">
                {parseInt(date.slice(8, 10))}
              </span>

              {/* Holiday pills */}
              <div className="hc-cal__events">
                {processedData[date]?.map((slot, laneIdx) => {
                  if (!slot) return <div key={`spacer-${laneIdx}`} className="hc-cal__event-spacer" />;
                  
                  const { holiday: h, type } = slot;
                  const longWknd = isLongWeekend(h);
                  
                  return (
                    <div
                      key={h.id}
                      className={[
                        "hc-cal__event",
                        `hc-cal__event--${type}`,
                      ].filter(Boolean).join(" ")}
                      style={{
                        background: HOLIDAY_TYPE_COLORS[h.holiday_type],
                        opacity: h.status === "draft" ? 0.6 : 1,
                        // Ensure fixed height for all segments
                        height: "22px",
                        minHeight: "22px",
                      }}
                      onClick={e => { e.stopPropagation(); onHolidayClick(h); }}
                      onMouseEnter={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setHovered({ holiday: h, x: rect.left, y: rect.bottom + 8 });
                      }}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {(type === "start" || type === "single") && (
                        <span className="hc-cal__event-label">
                          {longWknd && <span className="hc-lw-dot" title="Long weekend" />}
                          {h.title}
                        </span>
                      )}
                      {/* Show title also on 'middle' if it's the start of a week (Sunday) - Optional but nice */}
                      {type === "middle" && dow === 0 && (
                        <span className="hc-cal__event-label hc-cal__event-label--cont">
                          {h.title}
                        </span>
                      )}
                    </div>
                  );
                })}
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
