import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  HOLIDAY_TYPE_COLORS, HOLIDAY_TYPE_BG, HOLIDAY_TYPE_LABELS,
  getDatesInRange, isLongWeekend, normalizeUTCDate,
} from "../../api/holidays";
import type { Holiday } from "../../api/types";
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

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export const HolidayCalendar = ({
  holidays, year, month, onMonthChange,
  onDateClick, onHolidayClick, canEdit = false,
}: HolidayCalendarProps) => {
  const [hovered, setHovered] = useState<{ holiday: Holiday; x: number; y: number } | null>(null);

  const todayDate = new Date();
  const todayStr = todayDate.toISOString().slice(0, 10);

  // Build a lane-aware map: dateStr → { holiday, lane, isStart, isEnd, isMiddle }[]
  const processedData = useMemo(() => {
    const sortedHolidays = [...holidays].sort((a, b) => {
      const startA = a.start_date.slice(0, 10);
      const startB = b.start_date.slice(0, 10);
      if (startA !== startB) return startA.localeCompare(startB);
      // Longer holidays first to optimize packing
      const durA = normalizeUTCDate(a.end_date).getTime() - normalizeUTCDate(a.start_date).getTime();
      const durB = normalizeUTCDate(b.end_date).getTime() - normalizeUTCDate(b.start_date).getTime();
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

  const jumpToToday = () => {
    const d = new Date();
    onMonthChange(d.getFullYear(), d.getMonth());
  };

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const arr = [];
    for (let i = current - 5; i <= current + 5; i++) arr.push(i);
    return arr;
  }, []);

  return (
    <div className="hc-cal" role="application" aria-label="Holiday Calendar">
      {/* Navigation Header */}
      <div className="hc-cal__header">
        <div className="hc-cal__header-left">
          <div className="hc-cal__nav-group">
            <button className="hc-cal__nav-btn" onClick={prevMonth} aria-label="Previous Month">
              <ChevronLeft size={18} />
            </button>
            <div className="hc-cal__date-pickers">
              <select 
                value={month} 
                onChange={(e) => onMonthChange(year, parseInt(e.target.value))}
                className="hc-cal__select"
                aria-label="Select Month"
              >
                {MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i}>{name}</option>
                ))}
              </select>
              <select 
                value={year} 
                onChange={(e) => onMonthChange(parseInt(e.target.value), month)}
                className="hc-cal__select"
                aria-label="Select Year"
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button className="hc-cal__nav-btn" onClick={nextMonth} aria-label="Next Month">
              <ChevronRight size={18} />
            </button>
          </div>
          <button className="hc-cal__today-btn" onClick={jumpToToday}>Today</button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="hc-cal__weekdays" role="row">
        {WEEKDAYS_SHORT.map((wd, i) => (
          <div
            key={wd}
            role="columnheader"
            aria-label={WEEKDAYS[i]}
            className={`hc-cal__weekday${wd === "Sun" || wd === "Sat" ? " hc-cal__weekday--weekend" : ""}`}
          >
            {wd}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="hc-cal__grid" role="grid">
        {calendarDays.map(({ date, isCurrentMonth }) => {
          const dayDate = normalizeUTCDate(date);
          const dow = dayDate.getUTCDay();
          const isWeekend = dow === 0 || dow === 6;
          const isToday = date === todayStr;
          const daySlots = processedData[date] || [];
          const hasHolidays = daySlots.some(s => !!s);
          
          const ariaLabel = `${dayDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}${isToday ? ", Today" : ""}${hasHolidays ? ", Has Holidays" : ""}`;

          return (
            <div
              key={date}
              role="gridcell"
              aria-label={ariaLabel}
              tabIndex={isCurrentMonth ? 0 : -1}
              className={[
                "hc-cal__day",
                !isCurrentMonth ? "hc-cal__day--other" : "",
                isWeekend ? "hc-cal__day--weekend" : "",
                isToday ? "hc-cal__day--today" : "",
                hasHolidays ? "hc-cal__day--has-holiday" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => canEdit && isCurrentMonth && onDateClick(date)}
            >
              <span className="hc-cal__day-num" aria-hidden="true">
                {parseInt(date.slice(8, 10))}
              </span>

              {/* Holiday pills */}
              <div className="hc-cal__events">
                {daySlots.map((slot, laneIdx) => {
                  if (!slot) return <div key={`spacer-${laneIdx}`} className="hc-cal__event-spacer" aria-hidden="true" />;
                  
                  const { holiday: h, type } = slot;
                  const longWknd = isLongWeekend(h);
                  const isDraft = h.status === "draft";
                  
                  return (
                    <div
                      key={h.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${h.title}, ${HOLIDAY_TYPE_LABELS[h.holiday_type]} holiday`}
                      className={[
                        "hc-cal__event",
                        `hc-cal__event--${type}`,
                        isDraft ? "hc-cal__event--draft" : "",
                      ].filter(Boolean).join(" ")}
                      style={{
                        background: HOLIDAY_TYPE_COLORS[h.holiday_type],
                      }}
                      onClick={e => { e.stopPropagation(); onHolidayClick(h); }}
                      onMouseEnter={e => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setHovered({ holiday: h, x: rect.left, y: rect.bottom + 8 });
                      }}
                      onMouseLeave={() => setHovered(null)}
                      onKeyDown={e => e.key === 'Enter' && onHolidayClick(h)}
                    >
                      {(type === "start" || type === "single") && (
                        <span className="hc-cal__event-label">
                          {longWknd && <span className="hc-lw-dot" title="Long weekend" aria-hidden="true" />}
                          {h.title}
                        </span>
                      )}
                      {type === "middle" && dow === 0 && (
                        <span className="hc-cal__event-label hc-cal__event-label--cont">
                          {h.title}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {canEdit && isCurrentMonth && (
                <div className="hc-cal__day-add" title="Add holiday">
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
