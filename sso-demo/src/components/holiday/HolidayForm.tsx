import { useState, useEffect, useRef } from "react";
import type { Holiday, HolidayType, HolidayStatus } from "../../api/types";
import { HOLIDAY_TYPE_LABELS, HOLIDAY_TYPE_COLORS } from "../../api/holidays";
import { X, Calendar, ChevronDown } from "lucide-react";

interface HolidayFormProps {
  holiday?: Holiday | null;
  defaultDate?: string;
  onSave: (data: Partial<Holiday>) => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

const TYPES: HolidayType[] = ["mandatory", "optional", "festival", "regional", "company"];
const STATUSES: HolidayStatus[] = ["draft", "published", "archived"];

export const HolidayForm = ({ holiday, defaultDate, onSave, onClose, isLoading }: HolidayFormProps) => {
  const isEdit = !!holiday;
  const [form, setForm] = useState<Partial<Holiday>>({
    title: "",
    description: "",
    holiday_type: "company",
    start_date: defaultDate || new Date().toISOString().slice(0, 10),
    end_date: defaultDate || new Date().toISOString().slice(0, 10),
    is_optional: false,
    is_recurring: false,
    status: "draft",
    notify_employees: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (holiday) {
      setForm({
        title: holiday.title,
        description: holiday.description || "",
        holiday_type: holiday.holiday_type,
        start_date: holiday.start_date?.slice(0, 10),
        end_date: holiday.end_date?.slice(0, 10),
        is_optional: holiday.is_optional,
        is_recurring: holiday.is_recurring,
        status: holiday.status,
        notify_employees: holiday.notify_employees,
      });
    }
  }, [holiday]);

  const set = <K extends keyof Holiday>(k: K, v: Holiday[K]) =>
    setForm(p => ({ ...p, [k]: v }));

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.title?.trim()) errs.title = "Holiday name is required";
    if (form.title && form.title.length < 2) errs.title = "Name must be at least 2 characters";
    if (!form.start_date) errs.start_date = "Start date is required";
    if (!form.end_date) errs.end_date = "End date is required";
    if (form.start_date && form.end_date && form.end_date < form.start_date)
      errs.end_date = "End date must be on or after start date";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSave(form);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const accentColor = HOLIDAY_TYPE_COLORS[form.holiday_type || "company"];

  return (
    <div
      ref={overlayRef}
      className="hc-modal-overlay"
      onClick={handleOverlayClick}
    >
      <div className="hc-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="hc-modal__header" style={{ borderTop: `4px solid ${accentColor}` }}>
          <div>
            <h2 className="hc-modal__title">
              {isEdit ? "Edit Holiday" : "Add New Holiday"}
            </h2>
            <p className="hc-modal__subtitle">
              {isEdit ? "Update the holiday details below." : "Fill in the details to create a new holiday."}
            </p>
          </div>
          <button className="hc-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="hc-modal__body">
          <div className="hc-form-grid">
            {/* Holiday Name */}
            <div className="hc-field hc-field--full">
              <label className="hc-label">Holiday Name <span className="hc-required">*</span></label>
              <input
                className={`hc-input${errors.title ? " hc-input--error" : ""}`}
                value={form.title || ""}
                onChange={e => set("title", e.target.value)}
                placeholder="e.g. Republic Day"
                maxLength={255}
              />
              {errors.title && <span className="hc-error-msg">{errors.title}</span>}
            </div>

            {/* Description */}
            <div className="hc-field hc-field--full">
              <label className="hc-label">Description</label>
              <textarea
                className="hc-textarea"
                value={form.description || ""}
                onChange={e => set("description", e.target.value)}
                placeholder="Optional description or notes…"
                rows={2}
              />
            </div>

            {/* Type */}
            <div className="hc-field">
              <label className="hc-label">Holiday Type <span className="hc-required">*</span></label>
              <div className="hc-type-grid">
                {TYPES.map(t => (
                  <button
                    key={t}
                    type="button"
                    className={`hc-type-btn${form.holiday_type === t ? " hc-type-btn--active" : ""}`}
                    style={form.holiday_type === t ? {
                      background: HOLIDAY_TYPE_COLORS[t],
                      color: "#fff",
                      borderColor: HOLIDAY_TYPE_COLORS[t],
                    } : {}}
                    onClick={() => set("holiday_type", t)}
                  >
                    {HOLIDAY_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="hc-field">
              <label className="hc-label">Status</label>
              <div className="hc-select-wrap">
                <select
                  className="hc-select"
                  value={form.status}
                  onChange={e => set("status", e.target.value as HolidayStatus)}
                >
                  {STATUSES.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="hc-select-icon" />
              </div>
            </div>

            {/* Start Date */}
            <div className="hc-field">
              <label className="hc-label">Start Date <span className="hc-required">*</span></label>
              <div className="hc-input-icon-wrap">
                <Calendar size={14} className="hc-input-icon" />
                <input
                  type="date"
                  className={`hc-input hc-input--icon${errors.start_date ? " hc-input--error" : ""}`}
                  value={form.start_date || ""}
                  onChange={e => {
                    set("start_date", e.target.value);
                    if (!form.end_date || form.end_date < e.target.value)
                      set("end_date", e.target.value);
                  }}
                />
              </div>
              {errors.start_date && <span className="hc-error-msg">{errors.start_date}</span>}
            </div>

            {/* End Date */}
            <div className="hc-field">
              <label className="hc-label">End Date <span className="hc-required">*</span></label>
              <div className="hc-input-icon-wrap">
                <Calendar size={14} className="hc-input-icon" />
                <input
                  type="date"
                  className={`hc-input hc-input--icon${errors.end_date ? " hc-input--error" : ""}`}
                  value={form.end_date || ""}
                  min={form.start_date}
                  onChange={e => set("end_date", e.target.value)}
                />
              </div>
              {errors.end_date && <span className="hc-error-msg">{errors.end_date}</span>}
            </div>

            {/* Toggles */}
            <div className="hc-field hc-field--full">
              <div className="hc-toggle-row">
                <HcToggle
                  id="is_optional"
                  label="Optional Holiday"
                  hint="Employees can choose whether to take this day off"
                  checked={!!form.is_optional}
                  onChange={v => set("is_optional", v)}
                />
                <HcToggle
                  id="is_recurring"
                  label="Recurring Yearly"
                  hint="Automatically repeats every year on the same date"
                  checked={!!form.is_recurring}
                  onChange={v => set("is_recurring", v)}
                />
                <HcToggle
                  id="notify_employees"
                  label="Notify Employees"
                  hint="Send notifications when this holiday is published"
                  checked={!!form.notify_employees}
                  onChange={v => set("notify_employees", v)}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="hc-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={isLoading}
              style={{ background: accentColor, borderColor: accentColor }}
            >
              {isLoading ? (
                <span className="hc-btn-spinner" />
              ) : (
                isEdit ? "Save Changes" : "Create Holiday"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const HcToggle = ({
  id, label, hint, checked, onChange,
}: {
  id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void;
}) => (
  <label className="hc-toggle" htmlFor={id}>
    <div className="hc-toggle__info">
      <span className="hc-toggle__label">{label}</span>
      <span className="hc-toggle__hint">{hint}</span>
    </div>
    <div
      id={id}
      role="switch"
      aria-checked={checked}
      className={`hc-toggle__track${checked ? " hc-toggle__track--on" : ""}`}
      onClick={() => onChange(!checked)}
      tabIndex={0}
      onKeyDown={e => e.key === " " && onChange(!checked)}
    >
      <div className="hc-toggle__thumb" />
    </div>
  </label>
);
