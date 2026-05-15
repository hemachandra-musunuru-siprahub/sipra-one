import { describe, it, expect } from 'vitest';
import { 
  normalizeUTCDate, 
  diffInCalendarDays, 
  calculateTotalDays, 
  isLongWeekend,
  getBridgeDayInsight,
  getHolidayWeekday
} from './holidayAnalytics';
import type { Holiday } from './types';

describe('Holiday Analytics - Timezone Safety', () => {
  it('should normalize date strings to UTC midday', () => {
    const date = normalizeUTCDate('2026-05-20');
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(4); // 0-indexed
    expect(date.getUTCDate()).toBe(20);
    expect(date.getUTCHours()).toBe(12);
  });

  it('should calculate correct weekday name in UTC', () => {
    // 2026-05-20 is a Wednesday
    expect(getHolidayWeekday('2026-05-20')).toBe('Wednesday');
    // 2026-05-24 is a Sunday
    expect(getHolidayWeekday('2026-05-24')).toBe('Sunday');
  });

  it('should calculate correct duration for multi-day holidays', () => {
    expect(calculateTotalDays('2026-05-20', '2026-05-20')).toBe(1);
    expect(calculateTotalDays('2026-05-20', '2026-05-22')).toBe(3);
    expect(calculateTotalDays('2026-12-31', '2027-01-01')).toBe(2); // Cross-year
  });

  it('should detect long weekends accurately', () => {
    const mondayHoliday: Holiday = { start_date: '2026-05-18', end_date: '2026-05-18' } as any; // Monday
    const fridayHoliday: Holiday = { start_date: '2026-05-22', end_date: '2026-05-22' } as any; // Friday
    const wednesdayHoliday: Holiday = { start_date: '2026-05-20', end_date: '2026-05-20' } as any; // Wednesday

    expect(isLongWeekend(mondayHoliday)).toBe(true); // Monday is adjacent to Sunday
    expect(isLongWeekend(fridayHoliday)).toBe(true);  // Friday is adjacent to Saturday
    expect(isLongWeekend(wednesdayHoliday)).toBe(false);
  });

  it('should suggest bridge leave correctly', () => {
    const tuesdayHoliday: Holiday = { start_date: '2026-05-19' } as any; // Tuesday
    const thursdayHoliday: Holiday = { start_date: '2026-05-21' } as any; // Thursday
    const wednesdayHoliday: Holiday = { start_date: '2026-05-20' } as any; // Wednesday

    expect(getBridgeDayInsight(tuesdayHoliday)).toContain('Monday');
    expect(getBridgeDayInsight(thursdayHoliday)).toContain('Friday');
    expect(getBridgeDayInsight(wednesdayHoliday)).toBeNull();
  });

  it('should handle leap years correctly', () => {
    expect(calculateTotalDays('2024-02-28', '2024-03-01')).toBe(3); // 2024 is leap year
    expect(calculateTotalDays('2025-02-28', '2025-03-01')).toBe(2); // 2025 is not
  });
});
