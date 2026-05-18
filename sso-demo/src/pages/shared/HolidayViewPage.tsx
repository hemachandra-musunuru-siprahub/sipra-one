import { useState } from "react";
import { 
  Calendar as CalendarIcon, Clock, Zap, Info, Coffee 
} from "lucide-react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { useHolidays } from "../../hooks/useHolidays";
import { HolidayCalendar } from "../../components/holiday/HolidayCalendar";
import { HolidayDashboardWidgets } from "../../components/holiday/HolidayDashboardWidgets";
import { 
  HOLIDAY_TYPE_COLORS, HOLIDAY_TYPE_LABELS,
  normalizeUTCDate, getHolidayWeekday, getBridgeDayInsight 
} from "../../api/holidays";
import type { Holiday } from "../../api/types";
import { HolidayDetailsModal } from "../../components/holiday/HolidayDetailsModal";

interface HolidayViewPageProps {
  internalUser: any;
  role?: string;
}

export const HolidayViewPage = ({ internalUser, role }: HolidayViewPageProps) => {
  const effectiveRole = (role || internalUser?.role || "Employee") as "HR" | "Manager" | "Employee" | "Admin";
  
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [month, setMonth] = useState(new Date().getUTCMonth());
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);

  const { 
    publishedHolidays, upcomingHolidays, 
    nextHoliday, longWeekends, bridgeDays, countdownDays,
    stats, loading 
  } = useHolidays({ year });

  return (
    <DashboardLayout internalUser={internalUser} role={effectiveRole}>
      <div className="hc-dashboard">
        <header className="hc-header">
          <div className="hc-header__left">
            <h1 className="hc-title" style={{ fontSize: "2rem", fontWeight: 800 }}>Holiday Calendar</h1>
            <p className="hc-subtitle">Company-wide holidays and observances for {year}.</p>
          </div>
        </header>

        <HolidayDashboardWidgets stats={stats || undefined} isLoading={loading} />


        <div className="hc-main-grid">
          <div className="hc-grid__content">
            <div className="hc-content-card">
              {loading ? (
                <div className="hc-loading-state">
                  <div className="hc-btn-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                  <p>Synchronizing calendar...</p>
                </div>
              ) : publishedHolidays.length === 0 ? (
                <div className="hc-empty-state">
                  <div className="hc-empty-icon">
                    <CalendarIcon size={48} />
                  </div>
                  <h3>No Holidays Scheduled</h3>
                  <p>There are no holidays listed for {year} yet.</p>
                </div>
              ) : (
                <HolidayCalendar 
                  holidays={publishedHolidays}
                  year={year}
                  month={month}
                  onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
                  onDateClick={() => {}}
                  onHolidayClick={(h) => setSelectedHoliday(h)}
                  canEdit={false}
                />
              )}
            </div>
          </div>

          <aside className="hc-grid__sidebar">
            {nextHoliday && (
              <div className="hc-side-card hc-side-card--gradient">
                <div className="hc-side-card__header">
                  <Clock size={14} /> Next Break
                </div>
                <div className="hc-countdown">
                  <span className="hc-countdown__value">{countdownDays}</span>
                  <span className="hc-countdown__label">Days To Go</span>
                </div>
                <div className="hc-countdown__footer">
                  <span className="hc-countdown__title">{nextHoliday.title}</span>
                  <div className="hc-countdown__meta">
                    <span>{normalizeUTCDate(nextHoliday.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span className="hc-timeline-tag" style={{ color: "white", background: "rgba(255,255,255,0.2)" }}>
                      {HOLIDAY_TYPE_LABELS[nextHoliday.holiday_type]}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {(longWeekends.length > 0 || bridgeDays.length > 0) && (
              <div className="hc-side-card">
                <div className="hc-side-card__header">
                  <Zap size={14} /> Planning Insights
                </div>
                <div className="hc-insights-list">
                  {longWeekends.map((h, i) => (
                    <div key={i} className="hc-insight-item">
                      <div className="hc-insight-icon hc-insight-icon--zap"><Zap size={14} /></div>
                      <div className="hc-insight-content">
                        <p>Long Weekend!</p>
                        <span>{h.title} starts on {getHolidayWeekday(h.start_date)}.</span>
                      </div>
                    </div>
                  ))}
                  {bridgeDays.map((h, i) => {
                    const insight = getBridgeDayInsight(h);
                    return (
                      <div key={i} className="hc-insight-item">
                        <div className="hc-insight-icon hc-insight-icon--bridge"><Coffee size={14} /></div>
                        <div className="hc-insight-content">
                          <p>Bridge Leave Tip</p>
                          <span>{insight || `Take a day off near ${h.title} for a longer break.`}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {upcomingHolidays.length > 0 && (
              <div className="hc-side-card">
                <div className="hc-side-card__header">
                  <CalendarIcon size={14} /> Upcoming Timeline
                </div>
                <div className="hc-timeline">
                  {upcomingHolidays.map((h) => (
                    <div key={h.id} className="hc-timeline-item" onClick={() => setSelectedHoliday(h)} style={{ cursor: 'pointer' }}>
                      <div className="hc-timeline-marker" />
                      <div className="hc-timeline-content">
                        <span className="hc-timeline-date">{normalizeUTCDate(h.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        <h4 className="hc-timeline-title">{h.title}</h4>
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
            )}

            <div className="hc-side-card">
              <div className="hc-side-card__header">
                <Info size={14} /> Legend
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

        {selectedHoliday && (
          <HolidayDetailsModal 
            holiday={selectedHoliday}
            onClose={() => setSelectedHoliday(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
};
