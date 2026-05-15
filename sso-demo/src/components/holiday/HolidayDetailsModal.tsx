import { X, Calendar, MapPin, Tag, Info, User, Clock } from "lucide-react";
import type { Holiday } from "../../api/types";
import { HOLIDAY_TYPE_LABELS, HOLIDAY_TYPE_COLORS, calculateTotalDays, getHolidayWeekday } from "../../api/holidays";

interface HolidayDetailsModalProps {
  holiday: Holiday;
  onClose: () => void;
  onEdit?: (holiday: Holiday) => void;
  canEdit?: boolean;
}

export const HolidayDetailsModal = ({ holiday, onClose, onEdit, canEdit }: HolidayDetailsModalProps) => {
  const duration = calculateTotalDays(holiday.start_date, holiday.end_date);
  const startDay = getHolidayWeekday(holiday.start_date);
  const endDay = getHolidayWeekday(holiday.end_date);

  return (
    <div className="hc-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hc-modal hc-modal--details" role="dialog" aria-modal="true">
        <div className="hc-modal__header" style={{ borderTop: `4px solid ${HOLIDAY_TYPE_COLORS[holiday.holiday_type]}` }}>
          <div>
            <h2 className="hc-modal__title">{holiday.title}</h2>
            <div className="hc-modal__badge-row">
              <span className="hc-timeline-tag" style={{ color: HOLIDAY_TYPE_COLORS[holiday.holiday_type], background: `${HOLIDAY_TYPE_COLORS[holiday.holiday_type]}15` }}>
                {HOLIDAY_TYPE_LABELS[holiday.holiday_type]}
              </span>
              {holiday.is_optional && <span className="hc-timeline-tag hc-timeline-tag--optional">Optional</span>}
              <span className={`hc-status-tag hc-status-tag--${holiday.status}`}>{holiday.status}</span>
            </div>
          </div>
          <button className="hc-modal__close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="hc-modal__body">
          <div className="hc-details-grid">
            <div className="hc-details-main">
              <section className="hc-details-section">
                <h4 className="hc-details-label"><Info size={14} /> Description</h4>
                <p className="hc-details-text">
                  {holiday.description || "No description provided for this holiday."}
                </p>
              </section>

              <div className="hc-details-row">
                <section className="hc-details-section">
                  <h4 className="hc-details-label"><Calendar size={14} /> Start Date</h4>
                  <p className="hc-details-value">{new Date(`${holiday.start_date}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <span className="hc-details-sub">{startDay}</span>
                </section>
                <section className="hc-details-section">
                  <h4 className="hc-details-label"><Calendar size={14} /> End Date</h4>
                  <p className="hc-details-value">{new Date(`${holiday.end_date}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <span className="hc-details-sub">{endDay}</span>
                </section>
              </div>
            </div>

            <aside className="hc-details-aside">
              <div className="hc-info-card">
                <div className="hc-info-item">
                  <Clock size={16} />
                  <div>
                    <span>Duration</span>
                    <strong>{duration} {duration === 1 ? "Day" : "Days"}</strong>
                  </div>
                </div>
                <div className="hc-info-item">
                  <MapPin size={16} />
                  <div>
                    <span>Applicability</span>
                    <strong>Company-wide</strong>
                  </div>
                </div>
                <div className="hc-info-item">
                  <User size={16} />
                  <div>
                    <span>Created By</span>
                    <strong>System Administrator</strong>
                  </div>
                </div>
                <div className="hc-info-item">
                  <Tag size={16} />
                  <div>
                    <span>Recurring</span>
                    <strong>{holiday.is_recurring ? "Every Year" : "One-time"}</strong>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>

        <div className="hc-modal__footer">
          <button className="hc-btn hc-btn--secondary" onClick={onClose}>Close</button>
          {canEdit && onEdit && (
            <button className="hc-btn hc-btn--primary" onClick={() => onEdit(holiday)}>Edit Holiday</button>
          )}
        </div>
      </div>
    </div>
  );
};
