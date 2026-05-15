import { useState, useRef } from "react";
import { X, Upload, CheckCircle, AlertCircle, AlertTriangle, Download } from "lucide-react";
import type { Holiday, HolidayImportResult } from "../../api/types";
import { importHolidays } from "../../api/holidays";
import toast from "react-hot-toast";

interface HolidayImportModalProps {
  onClose: () => void;
  onSuccess: (holidays: Holiday[]) => void;
}

export const HolidayImportModal = ({ onClose, onSuccess }: HolidayImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<HolidayImportResult | null>(null);
  const [publishOnImport, setPublishOnImport] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Please upload an Excel (.xlsx, .xls) or CSV file");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsLoading(true);
    try {
      const res = await importHolidays(file, publishOnImport);
      setResult(res);
      if (res.imported > 0) {
        toast.success(`Imported ${res.imported} holiday${res.imported !== 1 ? "s" : ""}!`);
        onSuccess(res.holidays);
      }
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const csvContent = [
      "Holiday Name,Description,Type,Start Date,End Date,Optional,Recurring",
      "Republic Day,National holiday,mandatory,2026-01-26,2026-01-26,No,Yes",
      "Diwali,Festival of lights,festival,2026-10-20,2026-10-21,No,Yes",
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "holiday-import-template.csv";
    a.click();
  };

  return (
    <div className="hc-modal-overlay">
      <div className="hc-modal" style={{ maxWidth: 580 }}>
        <div className="hc-modal__header" style={{ borderTop: "4px solid #3B82F6" }}>
          <div>
            <h2 className="hc-modal__title">Bulk Import Holidays</h2>
            <p className="hc-modal__subtitle">Upload an Excel or CSV file to import holidays.</p>
          </div>
          <button className="hc-modal__close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="hc-modal__body">
          {/* Template download */}
          <div className="hc-import-tip">
            <span>Need a template?</span>
            <button className="btn btn--ghost btn--sm" onClick={downloadTemplate} style={{ gap: 4, display: "flex", alignItems: "center" }}>
              <Download size={13} /> Download CSV Template
            </button>
          </div>

          {/* Drop zone */}
          <div
            className={`hc-dropzone${dragging ? " hc-dropzone--active" : ""}${file ? " hc-dropzone--filled" : ""}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !file && inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            {file ? (
              <div className="hc-dropzone__file">
                <CheckCircle size={20} style={{ color: "#10B981" }} />
                <span>{file.name}</span>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }}
                >
                  <X size={14} /> Remove
                </button>
              </div>
            ) : (
              <div className="hc-dropzone__empty">
                <Upload size={24} style={{ color: "var(--neutral-400)" }} />
                <p>Drag & drop your file here, or <span style={{ color: "#3B82F6", textDecoration: "underline", cursor: "pointer" }}>browse</span></p>
                <span style={{ fontSize: "0.75rem", color: "var(--neutral-400)" }}>Supports .xlsx, .xls, .csv</span>
              </div>
            )}
          </div>

          {/* Publish toggle */}
          {file && (
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginTop: 8 }}>
              <div
                role="switch"
                aria-checked={publishOnImport}
                className={`hc-toggle__track${publishOnImport ? " hc-toggle__track--on" : ""}`}
                onClick={() => setPublishOnImport(p => !p)}
                style={{ flexShrink: 0 }}
              >
                <div className="hc-toggle__thumb" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Publish immediately</div>
                <div style={{ fontSize: "0.75rem", color: "var(--neutral-500)" }}>Employees will see these holidays right away</div>
              </div>
            </label>
          )}

          {/* Preview results */}
          {result && (
            <div className="hc-import-results">
              <div className="hc-import-summary">
                <span className="hc-import-badge hc-import-badge--ok"><CheckCircle size={12} /> {result.imported} imported</span>
                {result.duplicates > 0 && <span className="hc-import-badge hc-import-badge--warn"><AlertTriangle size={12} /> {result.duplicates} duplicates</span>}
                {result.errors > 0 && <span className="hc-import-badge hc-import-badge--err"><AlertCircle size={12} /> {result.errors} errors</span>}
              </div>
              <div className="hc-import-rows">
                {result.results.filter(r => r.status !== "ok").map(r => (
                  <div key={r.row} className={`hc-import-row hc-import-row--${r.status}`}>
                    <span>Row {r.row}</span>
                    <span>{r.error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="hc-modal__footer">
          <button className="btn btn--secondary" onClick={onClose}>Close</button>
          {file && !result && (
            <button className="btn btn--primary" onClick={handleImport} disabled={isLoading}>
              {isLoading ? <span className="hc-btn-spinner" /> : <><Upload size={15} /> Import Holidays</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
