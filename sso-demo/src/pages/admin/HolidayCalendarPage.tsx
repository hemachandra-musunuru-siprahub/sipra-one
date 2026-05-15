import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { HolidayCalendar } from "../../components/holiday/HolidayCalendar";
import { HolidayTable } from "../../components/holiday/HolidayTable";
import { HolidayForm } from "../../components/holiday/HolidayForm";
import { HolidayDashboardWidgets } from "../../components/holiday/HolidayDashboardWidgets";
import { HolidayImportModal } from "../../components/holiday/HolidayImportModal";
import {
  getHolidays, createHoliday, updateHoliday, deleteHoliday,
  duplicateHoliday, updateHolidayStatus, bulkPublish, exportHolidays,
  HOLIDAY_TYPE_LABELS,
} from "../../api/holidays";
import type { Holiday, HolidayFilters, HolidayStats } from "../../api/types";
import {
  Plus, Upload, Download, CalendarDays, Table2,
  ChevronLeft, ChevronRight, Search, Filter, Eye, EyeOff, Trash2,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import { socket } from "../../lib/socket";

interface HolidayCalendarPageProps {
  internalUser: any;
}

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i);
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

type ViewMode = "calendar" | "table";

export const HolidayCalendarPage = ({ internalUser }: HolidayCalendarPageProps) => {
  const isAdmin = internalUser?.role === "Admin";
  const isHR    = internalUser?.role === "HR";
  const canEdit  = isAdmin || isHR;
  const canDelete = isAdmin;

  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [view, setView]   = useState<ViewMode>("calendar");

  const [holidays, setHolidays]   = useState<Holiday[]>([]);
  const [stats, setStats]         = useState<HolidayStats | undefined>();
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState<HolidayFilters>({ year });
  const [search, setSearch]   = useState("");

  const [showForm, setShowForm]       = useState(false);
  const [editHoliday, setEditHoliday] = useState<Holiday | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [isSaving, setIsSaving]       = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter]     = useState<string>("");

  const fetchHolidays = useCallback(async () => {
    setIsLoading(true);
    try {
      const f: HolidayFilters = { year, search: search || undefined };
      if (statusFilter) f.status = statusFilter as Holiday["status"];
      if (typeFilter)   f.holiday_type = typeFilter as Holiday["holiday_type"];
      const res = await getHolidays(f);
      setHolidays(res.holidays || []);
      setStats(res.stats);
    } catch {
      toast.error("Failed to load holidays");
    } finally {
      setIsLoading(false);
    }
  }, [year, search, statusFilter, typeFilter]);

  useEffect(() => { fetchHolidays(); }, [fetchHolidays]);

  // Real-time holiday updates via Socket.IO
  useEffect(() => {
    const handler = () => fetchHolidays();
    socket.on("holiday:updated", handler);
    return () => { socket.off("holiday:updated", handler); };
  }, [fetchHolidays]);

  const openCreate = (date?: string) => {
    setEditHoliday(null);
    setDefaultDate(date);
    setShowForm(true);
  };

  const openEdit = (h: Holiday) => {
    setEditHoliday(h);
    setDefaultDate(undefined);
    setShowForm(true);
  };

  const handleSave = async (data: Partial<Holiday>) => {
    setIsSaving(true);
    try {
      if (editHoliday) {
        const res = await updateHoliday(editHoliday.id, data);
        setHolidays(prev => prev.map(h => h.id === editHoliday.id ? res.holiday : h));
        toast.success("Holiday updated!");
      } else {
        const res = await createHoliday(data);
        setHolidays(prev => [...prev, res.holiday]);
        if (res.holiday.status === "published") {
          toast.success("Holiday published!");
        } else {
          toast.success("Holiday created as draft.");
        }
      }
      setShowForm(false);
      fetchHolidays(); // refresh stats
    } catch (err: any) {
      toast.error(err.message || "Failed to save holiday");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (h: Holiday) => {
    if (!window.confirm(`Delete "${h.title}"? This action cannot be undone.`)) return;
    try {
      await deleteHoliday(h.id);
      setHolidays(prev => prev.filter(x => x.id !== h.id));
      toast.success("Holiday deleted.");
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleDuplicate = async (h: Holiday) => {
    try {
      const res = await duplicateHoliday(h.id);
      setHolidays(prev => [...prev, res.holiday]);
      toast.success(`"${h.title}" duplicated as draft.`);
    } catch {
      toast.error("Failed to duplicate");
    }
  };

  const handleStatusChange = async (h: Holiday, status: Holiday["status"]) => {
    try {
      const res = await updateHolidayStatus(h.id, status);
      setHolidays(prev => prev.map(x => x.id === h.id ? res.holiday : x));
      if (status === "published") toast.success(`"${h.title}" is now live for all employees!`);
      else if (status === "draft") toast.success("Holiday unpublished.");
      else toast.success("Holiday archived.");
      fetchHolidays();
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleBulkPublish = async (status: Holiday["status"]) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setIsBulkLoading(true);
    try {
      await bulkPublish(ids, status);
      toast.success(`${ids.length} holiday${ids.length !== 1 ? "s" : ""} ${status === "published" ? "published" : "updated"}.`);
      setSelectedIds(new Set());
      fetchHolidays();
    } catch {
      toast.error("Bulk update failed");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(holidays.map(h => h.id)));
    else setSelectedIds(new Set());
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const prevMonth = () => month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1);
  const nextMonth = () => month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1);

  // Filter holidays visible in current calendar month
  const visibleHolidays = view === "calendar"
    ? holidays.filter(h => {
        const s = new Date(h.start_date), e = new Date(h.end_date);
        const mStart = new Date(year, month, 1), mEnd = new Date(year, month + 1, 0);
        return s <= mEnd && e >= mStart;
      })
    : holidays;

  return (
    <DashboardLayout internalUser={internalUser} role={internalUser?.role || "Admin"}>
      {/* ── Page Header ── */}
      <header className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="page-title">Holiday Calendar</h1>
            <p style={{ color: "var(--neutral-500)", fontSize: "0.875rem", marginTop: 2 }}>
              Manage company holidays, public holidays, and observances.
            </p>
          </div>
          {canEdit && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn--secondary btn--sm" onClick={() => setShowImport(true)}>
                <Upload size={15} /> Import
              </button>
              <button
                className="btn btn--secondary btn--sm"
                onClick={() => exportHolidays("xlsx", { year, status: statusFilter as any, holiday_type: typeFilter as any })}
              >
                <Download size={15} /> Export
              </button>
              <button className="btn btn--primary" onClick={() => openCreate()}>
                <Plus size={16} /> Add Holiday
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── KPI Widgets ── */}
      <HolidayDashboardWidgets stats={stats} isLoading={isLoading} />

      {/* ── Toolbar ── */}
      <div className="hc-toolbar">
        {/* Year selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button className="btn btn--ghost btn--sm" onClick={() => setYear(y => y - 1)}><ChevronLeft size={16} /></button>
          <select
            className="hc-select"
            style={{ width: 90, fontSize: "0.875rem" }}
            value={year}
            onChange={e => { setYear(Number(e.target.value)); setFilters(f => ({ ...f, year: Number(e.target.value) })); }}
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn btn--ghost btn--sm" onClick={() => setYear(y => y + 1)}><ChevronRight size={16} /></button>
        </div>

        {/* Month nav (calendar view only) */}
        {view === "calendar" && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button className="btn btn--ghost btn--sm" onClick={prevMonth}><ChevronLeft size={15} /></button>
            <span style={{ fontWeight: 600, fontSize: "0.875rem", minWidth: 100, textAlign: "center" }}>
              {MONTH_NAMES[month]}
            </span>
            <button className="btn btn--ghost btn--sm" onClick={nextMonth}><ChevronRight size={15} /></button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
          {canEdit && (
            <div className="hc-select-wrap" style={{ width: 130 }}>
              <select className="hc-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          )}
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
              style={{ paddingLeft: 32, width: 200 }}
              placeholder="Search holidays…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button className="btn btn--ghost btn--sm" onClick={fetchHolidays} title="Refresh">
            <RefreshCw size={15} />
          </button>
        </div>

        {/* View toggle */}
        <div className="hc-view-toggle">
          <button
            className={`hc-view-toggle__btn${view === "calendar" ? " hc-view-toggle__btn--active" : ""}`}
            onClick={() => setView("calendar")}
            title="Calendar view"
          >
            <CalendarDays size={15} />
          </button>
          <button
            className={`hc-view-toggle__btn${view === "table" ? " hc-view-toggle__btn--active" : ""}`}
            onClick={() => setView("table")}
            title="Table view"
          >
            <Table2 size={15} />
          </button>
        </div>
      </div>

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && canEdit && (
        <div className="hc-bulk-bar">
          <span>{selectedIds.size} selected</span>
          <button className="btn btn--sm btn--primary" onClick={() => handleBulkPublish("published")} disabled={isBulkLoading}>
            <Eye size={14} /> Publish All
          </button>
          <button className="btn btn--sm btn--secondary" onClick={() => handleBulkPublish("draft")} disabled={isBulkLoading}>
            <EyeOff size={14} /> Unpublish All
          </button>
          <button className="btn btn--sm btn--secondary" style={{ color: "var(--error-500)" }} onClick={() => handleBulkPublish("archived")} disabled={isBulkLoading}>
            <Trash2 size={14} /> Archive All
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card__body" style={{ padding: view === "calendar" ? 0 : undefined }}>
          {isLoading ? (
            <div className="hc-skeleton-wrap">
              <div className="hc-skeleton" style={{ height: 480, borderRadius: 8 }} />
            </div>
          ) : view === "calendar" ? (
            <HolidayCalendar
              holidays={visibleHolidays}
              year={year}
              month={month}
              onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
              onDateClick={canEdit ? openCreate : () => {}}
              onHolidayClick={canEdit ? openEdit : () => {}}
              canEdit={canEdit}
            />
          ) : (
            <HolidayTable
              holidays={visibleHolidays}
              canEdit={canEdit}
              canDelete={canDelete}
              selectedIds={selectedIds}
              onSelectAll={handleSelectAll}
              onSelectOne={handleSelectOne}
              onEdit={openEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onStatusChange={handleStatusChange}
            />
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showForm && (
        <HolidayForm
          holiday={editHoliday}
          defaultDate={defaultDate}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
          isLoading={isSaving}
        />
      )}

      {showImport && (
        <HolidayImportModal
          onClose={() => setShowImport(false)}
          onSuccess={imported => {
            setHolidays(prev => [...prev, ...imported]);
            setShowImport(false);
            fetchHolidays();
          }}
        />
      )}
    </DashboardLayout>
  );
};
