import type { Holiday } from "./types";

/**
 * Enforces a single timezone strategy globally.
 * All date strings are parsed into UTC midday to avoid local timezone drift.
 */
export const normalizeUTCDate = (dateInput: string | Date): Date => {
  if (dateInput instanceof Date) {
    // Already a date, but we want a normalized one at 12:00 UTC
    return new Date(Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate(), 12, 0, 0));
  }
  return new Date(`${dateInput.slice(0, 10)}T12:00:00Z`);
};

/**
 * Calculates the difference in full calendar days between two dates.
 * Uses UTC components to ensure deterministic results.
 */
export const diffInCalendarDays = (later: Date, earlier: Date): number => {
  const utc1 = Date.UTC(later.getUTCFullYear(), later.getUTCMonth(), later.getUTCDate());
  const utc2 = Date.UTC(earlier.getUTCFullYear(), earlier.getUTCMonth(), earlier.getUTCDate());
  return Math.floor((utc1 - utc2) / (1000 * 60 * 60 * 24));
};

/**
 * Returns the weekday name for a given holiday start date.
 * Guaranteed to be consistent across all dashboards.
 */
export const getHolidayWeekday = (dateStr: string): string => {
  const date = normalizeUTCDate(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
};

/**
 * Calculates the countdown from 'today' to the holiday start.
 * 'today' is normalized to its UTC equivalent at 12:00:00Z.
 */
export const calculateCountdownDays = (holiday: Holiday, today: Date = new Date()): number => {
  const hDate = normalizeUTCDate(holiday.start_date);
  const tDate = normalizeUTCDate(today);
  const diff = diffInCalendarDays(hDate, tDate);
  return diff < 0 ? 0 : diff;
};

/**
 * Detects if a holiday creates a "Long Weekend" by checking if it's 
 * adjacent to a Saturday or Sunday.
 */
export const isLongWeekend = (holiday: Holiday): boolean => {
  const s = normalizeUTCDate(holiday.start_date);
  const e = normalizeUTCDate(holiday.end_date);
  
  const dayBefore = new Date(s); dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const dayAfter  = new Date(e);   dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  
  const isSatSun = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;
  return isSatSun(dayBefore) || isSatSun(dayAfter);
};

/**
 * Suggests taking a "Bridge Leave" if a holiday falls on a Tuesday or Thursday.
 */
export const getBridgeDayInsight = (holiday: Holiday): string | null => {
  const s = normalizeUTCDate(holiday.start_date);
  const dow = s.getUTCDay();
  
  if (dow === 2) return `Take Monday off for a 4-day break!`;
  if (dow === 4) return `Take Friday off for a 4-day break!`;
  return null;
};

/**
 * Calculates the total duration of a holiday in days (inclusive).
 */
export const calculateTotalDays = (start: string, end: string): number => {
  const s = normalizeUTCDate(start);
  const e = normalizeUTCDate(end);
  return diffInCalendarDays(e, s) + 1;
};

/**
 * Finds the very next upcoming holiday from a list.
 */
export const getNextBreak = (holidays: Holiday[], today: Date = new Date()): Holiday | null => {
  const todayStr = today.toISOString().slice(0, 10);
  return [...holidays]
    .filter(h => h.status === 'published' && h.start_date >= todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0] || null;
};

/**
 * Filters and sorts upcoming holidays for the timeline view.
 */
export const getUpcomingTimeline = (holidays: Holiday[], limit = 5, today: Date = new Date()): Holiday[] => {
  const todayStr = today.toISOString().slice(0, 10);
  return [...holidays]
    .filter(h => h.status === 'published' && h.start_date >= todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, limit);
};
