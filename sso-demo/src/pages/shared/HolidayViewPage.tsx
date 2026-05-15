import { useState, useEffect, useMemo } from "react";
import { 
  Calendar as CalendarIcon,
  Clock, Zap, Info, Coffee
} from "lucide-react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { getHolidays, isLongWeekend, HOLIDAY_TYPE_COLORS, HOLIDAY_TYPE_LABELS } from "../../api/holidays";
import { HolidayCalendar } from "../../components/holiday/HolidayCalendar";
import { HolidayDashboardWidgets } from "../../components/holiday/HolidayDashboardWidgets";
import type { Holiday, HolidayStats } from "../../api/types";
import toast from "react-hot-toast";

interface HolidayViewPageProps {
  internalUser: any;
  role?: string;
}

export const HolidayViewPage = ({ internalUser, role }: HolidayViewPageProps) => {
  const effectiveRole = (role || internalUser?.role || "Employee") as "HR" | "Manager" | "Employee" | "Admin";
  
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [stats, setStats] = useState<HolidayStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [month, setMonth] = useState(new Date().getUTCMonth());

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getHolidays({ year });
      setHolidays((res.holidays || []).filter(h => h.status === "published"));
      if (res.stats) setStats(res.stats);
    } catch (e) {
      console.error("Failed to load holidays:", e);
      toast.error("Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [year]);

  const filteredHolidays = holidays;

  const nextHoliday = useMemo(() => {
    const now = new Date().toISOString().split("T")[0];
    return holidays
      .filter(h => h.start_date >= now)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  }, [holidays]);

  const upcomingHolidays = useMemo(() => {
    const now = new Date().toISOString().split("T")[0];
    return holidays
      .filter(h => h.start_date >= now)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 5);
  }, [holidays]);

  const longWeekends = useMemo(() => {
    const now = new Date().toISOString().split("T")[0];
    return holidays
      .filter(h => h.start_date >= now && isLongWeekend(h))
      .sort((a, b) => a.start_date.localeCompare(b.start_date))
      .slice(0, 3);
  }, [holidays]);

  const bridgeDays = useMemo(() => {
    const now = new Date().toISOString().split("T")[0];
    return holidays
      .filter(h => h.start_date >= now)
      .filter(h => {
        const d = new Date(`${h.start_date}T12:00:00Z`);
        const day = d.getUTCDay(); 
        return day === 2 || day === 4;
      })
      .slice(0, 2);
  }, [holidays]);

  const countdownDays = nextHoliday ? Math.ceil((new Date(`${nextHoliday.start_date}T12:00:00Z`).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

  return (
    <DashboardLayout internalUser={internalUser} role={effectiveRole}>
      <div className="hc-dashboard">
        <header className="hc-header">
          <div className="hc-header__left">
            <h1 className="hc-title">Holiday Calendar</h1>
            <p className="hc-subtitle">Company-wide holidays and observances for {year}.</p>
          </div>
        </header>


        <div className="hc-main-grid">
          <div className="hc-grid__content">
            <div className="hc-content-card">

              {loading ? (
                <div style={{ padding: 40, textAlign: "center", color: "var(--neutral-500)" }}>Loading calendar…</div>
              ) : (
                <HolidayCalendar 
                  holidays={filteredHolidays}
                  year={year}
                  month={month}
                  onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
                  onDateClick={() => {}}
                  onHolidayClick={() => {}}
                  canEdit={false}
                />
              )}
            </div>
          </div>

          <aside className="hc-grid__sidebar">
            {/* 1. Next Break Card */}
            {nextHoliday && (
              <div className="hc-side-card hc-side-card--gradient">
                <div className="hc-side-card__header">
                  <Clock size={14} />
                  <span>Next Break</span>
                </div>
                <div className="hc-countdown">
                  <div className="hc-countdown__value">{countdownDays}</div>
                  <div className="hc-countdown__label">Days To Go</div>
                </div>
                <div className="hc-countdown__footer">
                  <p className="hc-countdown__title">{nextHoliday.title}</p>
                  <div className="hc-countdown__meta">
                    <span>{new Date(`${nextHoliday.start_date}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="hc-timeline-tag" style={{ color: "white", background: "rgba(255,255,255,0.2)" }}>
                      {HOLIDAY_TYPE_LABELS[nextHoliday.holiday_type]}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Planning Insights Card */}
            <div className="hc-side-card">
              <div className="hc-side-card__header">
                <Zap size={14} />
                <span>Planning Insights</span>
              </div>
              <div className="hc-insights-list">
                {longWeekends.map((h) => (
                  <div key={h.id} className="hc-insight-item">
                    <div className="hc-insight-icon hc-insight-icon--zap"><Zap size={14} /></div>
                    <div className="hc-insight-content">
                      <p>Long Weekend!</p>
                      <span>{h.title} starts on {new Date(`${h.start_date}T12:00:00Z`).getUTCDay() === 5 ? "Friday" : "Monday"}.</span>
                    </div>
                  </div>
                ))}
                {bridgeDays.map((h) => (
                  <div key={`bridge-${h.id}`} className="hc-insight-item">
                    <div className="hc-insight-icon hc-insight-icon--bridge"><Coffee size={14} /></div>
                    <div className="hc-insight-content">
                      <p>Bridge Leave Tip</p>
                      <span>Take {new Date(`${h.start_date}T12:00:00Z`).getUTCDay() === 2 ? "Monday" : "Friday"} off for a 4-day break!</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Upcoming Timeline Card */}
            <div className="hc-side-card">
              <div className="hc-side-card__header">
                <CalendarIcon size={14} />
                <span>Upcoming Timeline</span>
              </div>
              <div className="hc-timeline">
                {upcomingHolidays.map((h) => (
                  <div key={h.id} className="hc-timeline-item">
                    <div className="hc-timeline-marker" />
                    <div className="hc-timeline-content">
                      <div className="hc-timeline-date">
                        {new Date(`${h.start_date}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                      <p className="hc-timeline-title">{h.title}</p>
                      <div className="hc-timeline-meta">
                        <span className="hc-timeline-tag" style={{ color: HOLIDAY_TYPE_COLORS[h.holiday_type], background: `${HOLIDAY_TYPE_COLORS[h.holiday_type]}15` }}>
                          {HOLIDAY_TYPE_LABELS[h.holiday_type]}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Holiday Legend Card */}
            <div className="hc-side-card">
              <div className="hc-side-card__header">
                <Info size={14} />
                <span>Legend</span>
              </div>
              <div className="hc-legend-card">
                {(["mandatory","optional","festival","regional","company"] as const).map(t => (
                  <div key={t} className="hc-legend-item">
                    <div className="hc-legend-dot" style={{ background: HOLIDAY_TYPE_COLORS[t] }} />
                    {HOLIDAY_TYPE_LABELS[t]}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
};
