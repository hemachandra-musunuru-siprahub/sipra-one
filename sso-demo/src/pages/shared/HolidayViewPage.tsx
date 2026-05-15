import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { HolidayCalendar } from "../../components/holiday/HolidayCalendar";
import { HolidayTable } from "../../components/holiday/HolidayTable";
import { getHolidays, exportHolidays, HOLIDAY_TYPE_LABELS } from "../../api/holidays";
import type { Holiday } from "../../api/types";
import { CalendarDays, Table2, ChevronLeft, ChevronRight, Download, Search, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { socket } from "../../lib/socket";

interface HolidayViewPageProps {
  internalUser: any;
  role?: string;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type ViewMode = "calendar" | "table";

export const HolidayViewPage = ({ internalUser, role }: HolidayViewPageProps) => {
  const effectiveRole = (role || internalUser?.role || "Employee") as "HR" | "Manager" | "Employee" | "Admin";
  const canExport = effectiveRole === "Manager" || effectiveRole === "HR" || effectiveRole === "Admin";

  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView]   = useState<ViewMode>("calendar");
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getHolidays({ year, search: search || undefined, holiday_type: typeFilter as any || undefined });
      setHolidays((res.holidays || []).filter(h => h.status === "published"));
    } catch {
      toast.error("Failed to load holidays");
    } finally {
      setIsLoading(false);
    }
  }, [year, search, typeFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const handler = () => fetch();
    socket.on("holiday:updated", handler);
    return () => { socket.off("holiday:updated", handler); };
  }, [fetch]);

  const prevMonth = () => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1);
  const nextMonth = () => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1);

  const visible = view === "calendar"
    ? holidays.filter(h => {
        const s = new Date(h.start_date), e = new Date(h.end_date);
        const mStart = new Date(year, month, 1), mEnd = new Date(year, month + 1, 0);
        return s <= mEnd && e >= mStart;
      })
    : holidays;

  return (
    <DashboardLayout internalUser={internalUser} role={effectiveRole}>
      <header className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="page-title">Holiday Calendar</h1>
            <p style={{ color: "var(--neutral-500)", fontSize: "0.875rem", marginTop: 2 }}>
              View published company holidays and observances for {year}.
            </p>
          </div>
          {canExport && (
            <button
              className="btn btn--secondary btn--sm"
              onClick={() => exportHolidays("xlsx", { year, holiday_type: typeFilter as any || undefined })}
            >
              <Download size={15} /> Export
            </button>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <div className="hc-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => setYear(y => y - 1)}><ChevronLeft size={16} /></button>
          <span style={{ fontWeight: 700, fontSize: "0.9rem", minWidth: 40, textAlign: "center" }}>{year}</span>
          <button className="btn btn--ghost btn--sm" onClick={() => setYear(y => y + 1)}><ChevronRight size={16} /></button>
        </div>

        {view === "calendar" && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button className="btn btn--ghost btn--sm" onClick={prevMonth}><ChevronLeft size={15} /></button>
            <span style={{ fontWeight: 600, fontSize: "0.875rem", minWidth: 100, textAlign: "center" }}>
              {MONTH_NAMES[month]}
            </span>
            <button className="btn btn--ghost btn--sm" onClick={nextMonth}><ChevronRight size={15} /></button>
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
          <div className="hc-select-wrap" style={{ width: 140 }}>
            <select className="hc-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
              <option value="">All Types</option>
              {Object.entries(HOLIDAY_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--neutral-400)" }} />
            <input
              className="hc-input"
              style={{ paddingLeft: 32, width: 180 }}
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn--ghost btn--sm" onClick={fetch} title="Refresh"><RefreshCw size={15} /></button>
        </div>

        <div className="hc-view-toggle">
          <button className={`hc-view-toggle__btn${view === "calendar" ? " hc-view-toggle__btn--active" : ""}`} onClick={() => setView("calendar")}>
            <CalendarDays size={15} />
          </button>
          <button className={`hc-view-toggle__btn${view === "table" ? " hc-view-toggle__btn--active" : ""}`} onClick={() => setView("table")}>
            <Table2 size={15} />
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__body" style={{ padding: view === "calendar" ? 0 : undefined }}>
          {isLoading ? (
            <div className="hc-skeleton-wrap">
              <div className="hc-skeleton" style={{ height: 480, borderRadius: 8 }} />
            </div>
          ) : view === "calendar" ? (
            <HolidayCalendar
              holidays={visible}
              year={year}
              month={month}
              onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
              onDateClick={() => {}}
              onHolidayClick={() => {}}
              canEdit={false}
            />
          ) : (
            <HolidayTable
              holidays={visible}
              canEdit={false}
              canDelete={false}
              selectedIds={new Set()}
              onSelectAll={() => {}}
              onSelectOne={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
              onDuplicate={() => {}}
              onStatusChange={() => {}}
            />
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};
