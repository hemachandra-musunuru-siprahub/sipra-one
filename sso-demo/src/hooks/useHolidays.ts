import { useState, useEffect, useMemo } from "react";
import {
  getHolidays,
  isLongWeekend,
  getNextBreak,
  getUpcomingTimeline,
  calculateCountdownDays,
  normalizeUTCDate
} from "../api/holidays";
import type { Holiday, HolidayStats, HolidayFilters } from "../api/types";
import toast from "react-hot-toast";


export const useHolidays = (filters: HolidayFilters = {}) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [stats, setStats] = useState<HolidayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getHolidays(filters);
      setHolidays(res.holidays || []);
      if (res.stats) setStats(res.stats);
    } catch (e: any) {
      console.error("Failed to load holidays:", e);
      const msg = e.message || "Failed to load holidays";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters.year, filters.status, filters.holiday_type, filters.search]);

  const publishedHolidays = useMemo(() => 
    holidays.filter(h => h.status === 'published'), 
  [holidays]);

  const today = useMemo(() => new Date(), []); // Centralized 'today' reference

  const upcomingHolidays = useMemo(() => 
    getUpcomingTimeline(publishedHolidays, 10, today), 
  [publishedHolidays, today]);

  const nextHoliday = useMemo(() => 
    getNextBreak(publishedHolidays, today), 
  [publishedHolidays, today]);

  const longWeekends = useMemo(() => 
    upcomingHolidays.filter(isLongWeekend),
  [upcomingHolidays]);

  const bridgeDays = useMemo(() => {
    return upcomingHolidays.filter(h => {
      const d = normalizeUTCDate(h.start_date);
      const day = d.getUTCDay();
      return day === 2 || day === 4;
    });
  }, [upcomingHolidays]);

  const countdownDays = useMemo(() => {
    if (!nextHoliday) return null;
    return calculateCountdownDays(nextHoliday, today);
  }, [nextHoliday, today]);

  return {
    holidays,
    publishedHolidays,
    upcomingHolidays,
    nextHoliday,
    longWeekends,
    bridgeDays,
    countdownDays,
    stats,
    loading,
    error,
    refresh: loadData
  };
};
