import { useState } from "react";
import type { Holiday } from "../../api/types";
import {
  HOLIDAY_TYPE_LABELS, HOLIDAY_TYPE_COLORS,
  isLongWeekend, calculateTotalDays,
} from "../../api/holidays";
import {
  MoreHorizontal, Edit2, Trash2, Copy, Eye, EyeOff,
  Archive, ChevronUp, ChevronDown,
} from "lucide-react";

interface HolidayTableProps {
  holidays: Holiday[];
  canEdit: boolean;
  canDelete: boolean;
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onEdit: (h: Holiday) => void;
  onDelete: (h: Holiday) => void;
  onDuplicate: (h: Holiday) => void;
  onStatusChange: (h: Holiday, status: Holiday["status"]) => void;
}

type SortField = "title" | "start_date" | "holiday_type" | "status";
type SortDir = "asc" | "desc";

const STATUS_STYLES: Record<Holiday["status"], { bg: string; color: string }> = {
  published: { bg: "rgba(16,185,129,.12)", color: "#047857" },
  draft:     { bg: "rgba(245,158,11,.12)", color: "#B45309" },
  archived:  { bg: "rgba(107,114,128,.12)", color: "#4B5563" },
};

export const HolidayTable = ({
  holidays, canEdit, canDelete, selectedIds,
  onSelectAll, onSelectOne, onEdit, onDelete, onDuplicate, onStatusChange,
}: HolidayTableProps) => {
  const [sortField, setSortField] = useState<SortField>("start_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(f); setSortDir("asc"); }
  };

  const sorted = [...holidays].sort((a, b) => {
    let av = a[sortField] as string;
    let bv = b[sortField] as string;
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const SortIcon = ({ field }: { field: SortField }) => (
    sortField === field
      ? sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      : <ChevronUp size={12} style={{ opacity: 0.3 }} />
  );

  const allSelected = holidays.length > 0 && holidays.every(h => selectedIds.has(h.id));

  if (holidays.length === 0) {
    return (
      <div className="hc-empty">
        <div className="hc-empty__icon">📅</div>
        <p className="hc-empty__title">No holidays found</p>
        <p className="hc-empty__sub">Try adjusting your filters or create a new holiday.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {canEdit && (
              <th style={{ width: 40 }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => onSelectAll(e.target.checked)}
                  aria-label="Select all"
                />
              </th>
            )}
            <th onClick={() => toggleSort("title")} style={{ cursor: "pointer" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                Name <SortIcon field="title" />
              </span>
            </th>
            <th onClick={() => toggleSort("holiday_type")} style={{ cursor: "pointer" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                Type <SortIcon field="holiday_type" />
              </span>
            </th>
            <th onClick={() => toggleSort("start_date")} style={{ cursor: "pointer" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                Date <SortIcon field="start_date" />
              </span>
            </th>
            <th>Duration</th>
            <th onClick={() => toggleSort("status")} style={{ cursor: "pointer" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                Status <SortIcon field="status" />
              </span>
            </th>
            <th>Flags</th>
            {canEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map(h => {
            const color = HOLIDAY_TYPE_COLORS[h.holiday_type];
            const statusStyle = STATUS_STYLES[h.status];
            const start = new Date(`${h.start_date.slice(0, 10)}T12:00:00Z`);
            const end   = new Date(`${h.end_date.slice(0, 10)}T12:00:00Z`);
            const diff = calculateTotalDays(h.start_date, h.end_date);
            
            const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => 
              d.toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

            const dateStr = h.start_date.slice(0, 10) === h.end_date.slice(0, 10)
              ? fmt(start, { day: "numeric", month: "short", year: "numeric" })
              : `${fmt(start, { day: "numeric", month: "short" })} – ${fmt(end, { day: "numeric", month: "short", year: "numeric" })}`;
            const longWknd = isLongWeekend(h);

            return (
              <tr key={h.id}>
                {canEdit && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(h.id)}
                      onChange={e => onSelectOne(h.id, e.target.checked)}
                    />
                  </td>
                )}
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: color, flexShrink: 0,
                        opacity: h.status === "draft" ? 0.5 : 1,
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: "var(--neutral-800)", fontSize: "0.875rem" }}>
                        {h.title}
                      </div>
                      {h.description && (
                        <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>
                          {h.description.slice(0, 60)}{h.description.length > 60 ? "…" : ""}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className="badge"
                    style={{
                      background: `${color}1a`,
                      color,
                      border: `1px solid ${color}30`,
                      fontSize: "0.6875rem",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontWeight: 600,
                    }}
                  >
                    {HOLIDAY_TYPE_LABELS[h.holiday_type]}
                  </span>
                </td>
                <td style={{ fontSize: "0.8125rem", color: "var(--neutral-600)" }}>{dateStr}</td>
                <td style={{ fontSize: "0.8125rem", color: "var(--neutral-500)" }}>
                  {diff === 1 ? "1 day" : `${diff} days`}
                </td>
                <td>
                  <span
                    style={{
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      fontSize: "0.6875rem",
                      padding: "2px 8px",
                      borderRadius: 999,
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {h.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {h.is_optional && (
                      <span className="hc-tag" style={{ fontSize: "0.6rem", padding: "1px 6px" }}>Optional</span>
                    )}
                    {h.is_recurring && (
                      <span className="hc-tag" style={{ fontSize: "0.6rem", padding: "1px 6px", background: "rgba(16,185,129,.1)", color: "#10B981" }}>Recurring</span>
                    )}
                    {longWknd && (
                      <span className="hc-tag" style={{ fontSize: "0.6rem", padding: "1px 6px", background: "rgba(249,115,22,.1)", color: "#F97316" }}>Long Wknd</span>
                    )}
                  </div>
                </td>
                {canEdit && (
                  <td style={{ position: "relative" }}>
                    <button
                      className="btn btn--ghost btn--sm"
                      style={{ padding: "4px 8px" }}
                      onClick={() => setOpenMenu(openMenu === h.id ? null : h.id)}
                      aria-label="Actions"
                    >
                      <MoreHorizontal size={15} />
                    </button>
                    {openMenu === h.id && (
                      <div className="hc-action-menu" onMouseLeave={() => setOpenMenu(null)}>
                        <button onClick={() => { onEdit(h); setOpenMenu(null); }}>
                          <Edit2 size={13} /> Edit
                        </button>
                        <button onClick={() => { onDuplicate(h); setOpenMenu(null); }}>
                          <Copy size={13} /> Duplicate
                        </button>
                        {h.status !== "published" && (
                          <button onClick={() => { onStatusChange(h, "published"); setOpenMenu(null); }}>
                            <Eye size={13} /> Publish
                          </button>
                        )}
                        {h.status === "published" && (
                          <button onClick={() => { onStatusChange(h, "draft"); setOpenMenu(null); }}>
                            <EyeOff size={13} /> Unpublish
                          </button>
                        )}
                        {h.status !== "archived" && (
                          <button onClick={() => { onStatusChange(h, "archived"); setOpenMenu(null); }}>
                            <Archive size={13} /> Archive
                          </button>
                        )}
                        {canDelete && (
                          <button
                            style={{ color: "var(--error-500)" }}
                            onClick={() => { onDelete(h); setOpenMenu(null); }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
