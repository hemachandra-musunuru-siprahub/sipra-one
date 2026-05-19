import { useState, useEffect, useMemo } from "react";
import { 
  Calendar as CalendarIcon, Plus, Download, Clock, Star, Info 
} from "lucide-react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { createHoliday, updateHoliday, deleteHoliday } from "../../api/holidays";
import { HolidayCalendar } from "../../components/holiday/HolidayCalendar";
import { HolidayForm } from "../../components/holiday/HolidayForm";
import { HolidayImportModal } from "../../components/holiday/HolidayImportModal";
import { HolidayDashboardWidgets } from "../../components/holiday/HolidayDashboardWidgets";
import { 
  HOLIDAY_TYPE_COLORS, HOLIDAY_TYPE_LABELS,
  normalizeUTCDate 
} from "../../api/holidays";
import { useHolidays } from "../../hooks/useHolidays";
import type { Holiday } from "../../api/types";
import { HolidayDetailsModal } from "../../components/holiday/HolidayDetailsModal";
import toast from "react-hot-toast";

interface HolidayCalendarPageProps {
  internalUser: any;
}

export const HolidayCalendarPage = ({ internalUser }: HolidayCalendarPageProps) => {
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [month, setMonth] = useState(new Date().getUTCMonth());
  const [selectedHoliday, setSelectedHoliday] = useState<Holiday | null>(null);
  
  const { 
    holidays, publishedHolidays, upcomingHolidays, 
    nextHoliday, countdownDays,
    stats, loading, refresh 
  } = useHolidays({ year });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  
  const canEdit = internalUser?.role === "Admin" || internalUser?.role === "HR";

  const handleEdit = (h: Holiday) => {
    setEditingHoliday(h);
    setSelectedHoliday(null);
    setIsFormOpen(true);
  };

  const handleSave = async (data: Partial<Holiday>) => {
    try {
      if (editingHoliday) {
        await updateHoliday(editingHoliday.id, data);
        toast.success("Holiday updated successfully");
      } else {
        await createHoliday(data as any);
        toast.success("Holiday created successfully");
      }
      setIsFormOpen(false);
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to save holiday");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this holiday?")) return;
    try {
      await deleteHoliday(id);
      toast.success("Holiday deleted");
      refresh();
    } catch (e) {
      console.error(e);
      toast.error("Failed to delete holiday");
    }
  };

  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "Admin"}>
      <div className="hc-dashboard">
        <header className="hc-header">
          <div className="hc-header__left">
            <h1 className="hc-title" style={{ fontSize: "2rem", fontWeight: 800 }}>Holiday Calendar</h1>
            <p className="hc-subtitle">Plan and manage organizational holidays across all regions.</p>
          </div>
          <div className="hc-header__actions">
            {canEdit && (
              <>
                <button className="hc-btn hc-btn--secondary" onClick={() => setIsImportOpen(true)}>
                  <Download size={16} /> Import
                </button>
                <button className="hc-btn hc-btn--primary" onClick={() => { setEditingHoliday(null); setIsFormOpen(true); }}>
                  <Plus size={16} /> Add Holiday
                </button>
              </>
            )}
          </div>
        </header>

        {(internalUser?.role === "Admin" || internalUser?.role === "HR") && (
          <HolidayDashboardWidgets stats={stats || undefined} isLoading={loading} />
        )}

        <div className="hc-main-grid">
          <div className="hc-grid__content">
            <div className="hc-content-card">
              {loading ? (
                <div className="hc-loading-state">
                  <div className="hc-btn-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
                  <p>Synchronizing calendar data...</p>
                </div>
              ) : holidays.length === 0 ? (
                <div className="hc-empty-state">
                  <div className="hc-empty-icon">
                    <CalendarIcon size={48} />
                  </div>
                  <h3>No Holidays Scheduled</h3>
                  <p>There are no holidays listed for {year}. Start planning your calendar today.</p>
                  {canEdit && (
                    <button className="hc-btn hc-btn--primary" onClick={() => setIsFormOpen(true)}>
                      <Plus size={16} /> Add First Holiday
                    </button>
                  )}
                </div>
              ) : (
                <HolidayCalendar 
                  holidays={holidays}
                  year={year}
                  month={month}
                  onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
                  onDateClick={(d) => { if (canEdit) { setEditingHoliday(null); setIsFormOpen(true); } }}
                  onHolidayClick={(h) => setSelectedHoliday(h)}
                  canEdit={canEdit}
                />
              )}
            </div>
          </div>

          <aside className="hc-grid__sidebar">
            {/* Next Break Widget */}
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
                    <span className="hc-timeline-tag">{HOLIDAY_TYPE_LABELS[nextHoliday.holiday_type]}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Timeline */}
            {upcomingHolidays.length > 0 && (
              <div className="hc-side-card">
                <div className="hc-side-card__header">
                  <Star size={14} /> Upcoming Timeline
                </div>
                <div className="hc-timeline">
                  {(showAllUpcoming ? upcomingHolidays : upcomingHolidays.slice(0, 3)).map((h, i) => (
                    <div key={i} className="hc-timeline-item" onClick={() => setSelectedHoliday(h)} style={{ cursor: 'pointer' }}>
                      <div className="hc-timeline-marker"></div>
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
                {upcomingHolidays.length > 3 && (
                  <button 
                    className="hc-btn hc-btn--secondary" 
                    style={{ marginTop: '8px', width: '100%', fontSize: '0.8125rem' }}
                    onClick={() => setShowAllUpcoming(!showAllUpcoming)}
                  >
                    {showAllUpcoming ? 'View Less' : `View More (${upcomingHolidays.length - 3})`}
                  </button>
                )}
              </div>
            )}

            {/* Legend Card */}
            <div className="hc-side-card">
              <div className="hc-side-card__header">
                <Info size={14} /> Legend
              </div>
              <div className="hc-legend-card">
                {Object.entries(HOLIDAY_TYPE_LABELS).map(([type, label]) => (
                  <div key={type} className="hc-legend-item">
                    <div className="hc-legend-dot" style={{ background: HOLIDAY_TYPE_COLORS[type] }}></div>
                    {label}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {/* Modals */}
        {selectedHoliday && (
          <HolidayDetailsModal 
            holiday={selectedHoliday}
            onClose={() => setSelectedHoliday(null)}
            onEdit={canEdit ? handleEdit : undefined}
            canEdit={canEdit}
          />
        )}

        {isFormOpen && (
          <HolidayForm 
            holiday={editingHoliday || undefined}
            onSave={handleSave}
            onClose={() => setIsFormOpen(false)}
          />
        )}

        {isImportOpen && (
          <HolidayImportModal 
            onSuccess={() => { setIsImportOpen(false); refresh(); }}
            onClose={() => setIsImportOpen(false)}
          />
        )}
      </div>
    </DashboardLayout>
  );
};
