import { useState, useRef, useId } from "react";
import type React from "react";
import type { DragEvent } from "react";
import { Pin, X, UploadCloud, Check, ImageIcon } from "lucide-react";
import { api } from "../api/client";

import type { Announcement } from "../api/types";

interface Props {
  onSuccess: () => void;
  onCancel: () => void;
  initialData?: Partial<Announcement>;
}

export const AnnouncementForm = ({ onSuccess, onCancel, initialData }: Props) => {
  const [title, setTitle] = useState(initialData?.title || "");
  const [body, setBody] = useState(initialData?.body || "");
  const [isPinned, setIsPinned] = useState(initialData?.is_pinned || false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const bodyId = useId();

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSubmit = async (e: React.FormEvent, submitStatus: "draft" | "published" = "published") => {
    e.preventDefault();
    if (!title || !body) return;
    
    setSubmitting(true);
    const payload = {
      title,
      body,
      is_pinned: isPinned,
      status: submitStatus,
      image_url: initialData?.image_url || null,
      created_by_oid: initialData?.created_by_oid || null
    };

    try {
      let finalImageUrl = payload.image_url;

      if (imageFile) {
        finalImageUrl = await fileToBase64(imageFile);
      }

      const finalPayload = {
        ...payload,
        image_url: finalImageUrl
      };

      if (initialData?.id) {
        await api.patch(`/api/announcements/${initialData.id}`, finalPayload);
      } else {
        await api.post("/api/announcements", finalPayload);
      }
      onSuccess();
    } catch (err) {
      const error = err as any;
      const errorMsg = error.response?.data?.message || error.message || "An unexpected error occurred";
      console.error("[API] Publish Error:", errorMsg);
      alert(`Failed to publish: ${errorMsg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-xl overflow-hidden animate-fade-in" style={{ maxHeight: '85vh' }}>
      {/* ── Sticky Header ── */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
        <div>
          <h2 className="text-base font-bold text-gray-900">{initialData ? "Edit Announcement" : "New Announcement"}</h2>
          <p className="text-[11px] text-gray-400 mt-0.5 uppercase tracking-wider font-semibold">Share an update with the company</p>
        </div>
        <button 
          onClick={onCancel}
          className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-all"
        >
          <X size={18} />
        </button>
      </div>
      
      {/* ── Scrollable Body ── */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        <form id="announcement-form" className="flex flex-col gap-4">
          {/* Title Field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={titleId} className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">
              Headline <span className="text-red-500">*</span>
            </label>
            <input 
              id={titleId}
              type="text" 
              placeholder="E.g., Q3 Company All-Hands Meeting" 
              autoFocus
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder:text-gray-300 font-medium"
              value={title} 
              onChange={e => setTitle(e.target.value)} 
            />
          </div>

          {/* Body Field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={bodyId} className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">
              Message Content <span className="text-red-500">*</span>
            </label>
            <textarea 
              id={bodyId}
              rows={6} 
              placeholder="What do people need to know?..." 
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none transition-all resize-none placeholder:text-gray-300 leading-relaxed min-h-[120px]"
              value={body} 
              onChange={e => setBody(e.target.value)} 
            />
          </div>

          {/* Compact Toggle Row */}
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2">
              <Pin size={14} className="text-gray-400" />
              <span className="text-xs font-semibold text-gray-700">Pin to Feed Top</span>
            </div>
            <button
              type="button"
              onClick={() => setIsPinned(!isPinned)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                isPinned ? 'bg-red-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${isPinned ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Compact Upload Section */}
          <div className="flex flex-col gap-1.5 mt-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-tight">Featured Image</label>
            
            {imagePreview ? (
              <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50 aspect-video max-h-40">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 bg-white text-gray-900 rounded-md shadow-sm hover:bg-gray-50 transition-colors"
                  >
                    <UploadCloud size={16} />
                  </button>
                  <button 
                    type="button"
                    onClick={removeImage}
                    className="p-1.5 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div 
                className={`border border-dashed rounded-lg p-4 transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                  isDragging ? "border-red-500 bg-red-50" : "border-gray-200 hover:border-gray-400 bg-gray-50 hover:bg-white"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="flex items-center gap-2 text-gray-400">
                  <ImageIcon size={20} />
                  <span className="text-xs font-medium">Click to upload or drag & drop</span>
                </div>
                <p className="text-[10px] text-gray-400">Recommended: 1200x630 (max. 5MB)</p>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
            )}
          </div>
        </form>
      </div>

      {/* ── Sticky Footer ── */}
      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between shrink-0">
        <button 
          type="button" 
          className="text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
          onClick={onCancel}
        >
          Discard
        </button>
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-all shadow-xs disabled:opacity-50"
            onClick={(e) => handleSubmit(e, "draft")}
            disabled={submitting || !title || !body}
          >
            {submitting ? "..." : "Save Draft"}
          </button>
          <button 
            type="submit" 
            form="announcement-form"
            className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 rounded-md hover:bg-red-700 transition-all shadow-sm focus:ring-2 focus:ring-red-500 focus:ring-offset-1 disabled:opacity-50"
            onClick={(e) => handleSubmit(e, "published")}
            disabled={submitting || !title || !body}
          >
            {submitting ? "Saving..." : (initialData ? "Save Changes" : "Publish Now")}
          </button>
        </div>
      </div>
    </div>
  );
};
