import { useState, useRef, useId } from "react";
import type React from "react";
import type { DragEvent } from "react";
import { Pin, X, UploadCloud, Check } from "lucide-react";
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
  const [category, setCategory] = useState(initialData?.category || "");
  const [type, setType] = useState<"GENERAL" | "IMPORTANT">(() => {
    if (initialData?.type) return initialData.type;
    // Backward compatibility for priority field
    const oldPriority = (initialData as any)?.priority;
    if (oldPriority === 'high') return 'IMPORTANT';
    return 'GENERAL';
  });
  const [isPinned, setIsPinned] = useState(initialData?.is_pinned || false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const categoryId = useId();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;
    
    setSubmitting(true);
    const payload = {
      title,
      body,
      category: category || null,
      type,
      is_pinned: isPinned,
      image_url: initialData?.image_url || null,
      created_by_oid: initialData?.created_by_oid || null
    };

    console.log(`[API] Submitting ${initialData?.id ? "Update" : "Publication"}:`, payload);
    
    try {
      let finalImageUrl = payload.image_url;

      if (imageFile) {
        console.log("[API] Processing image upload (Base64)...");
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const error = err as any;
      const errorMsg = error.response?.data?.message || error.message || "An unexpected error occurred";
      const details = error.response?.data?.details;
      console.error("[API] Publish Error:", { message: errorMsg, details });
      alert(`Failed to publish: ${errorMsg}${details ? "\n\nDetails: " + JSON.stringify(details) : ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto w-full max-w-2xl shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{initialData ? "Edit Announcement" : "Create Announcement"}</h2>
          <p className="text-sm text-gray-500 mt-1">{initialData ? "Update the details below." : "Share an update with the company."}</p>
        </div>
        <button 
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      <form className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={titleId} className="text-sm font-semibold text-gray-700">
            Title <span className="text-red-500">*</span>
          </label>
          <input 
            id={titleId}
            type="text" 
            placeholder="E.g., Q3 Company All-Hands Meeting" 
            required
            className="w-full px-4 py-3 text-lg font-medium border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all duration-200 text-gray-900 placeholder:text-gray-400"
            value={title} 
            onChange={e => setTitle(e.target.value)} 
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={bodyId} className="text-sm font-semibold text-gray-700">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea 
            id={bodyId}
            rows={5} 
            placeholder="What do people need to know?..." 
            required
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all duration-200 resize-y text-gray-900 placeholder:text-gray-400 leading-relaxed"
            value={body} 
            onChange={e => setBody(e.target.value)} 
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor={categoryId} className="text-sm font-semibold text-gray-700">Category</label>
            <select 
              id={categoryId}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white transition-all text-gray-900 cursor-pointer"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Select a category...</option>
              <option value="HR">Human Resources</option>
              <option value="IT">IT Support</option>
              <option value="Events">Company Events</option>
              <option value="General">General Updates</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-gray-700">Announcement Type</label>
            <div className="flex items-center gap-2">
              {(['GENERAL', 'IMPORTANT'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border transition-all ${
                    type === t 
                      ? t === 'IMPORTANT' ? 'bg-orange-50 border-orange-200 text-orange-700 ring-1 ring-orange-500' :
                        'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-500'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  } flex items-center justify-center gap-1.5`}
                >
                  {type === t && <Check size={14} />}
                  {t === 'GENERAL' ? 'General' : 'Important'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-gray-100 mb-2">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Pin size={16} className="text-gray-500" />
              Pin to Top
            </span>
            <span className="text-xs text-gray-500">Keep this announcement at the top of the feed</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPinned}
            onClick={() => setIsPinned(!isPinned)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${
              isPinned ? 'bg-red-600' : 'bg-gray-200'
            }`}
          >
            <span
              aria-hidden="true"
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isPinned ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-gray-700">Feature Image <span className="text-gray-400 font-normal">(Optional)</span></span>
          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
              isDragging ? "border-red-500 bg-red-50" : "border-gray-200 hover:border-red-400 bg-gray-50/50 hover:bg-gray-50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !imagePreview && fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <div className="relative inline-block w-full" onClick={(e) => e.stopPropagation()}>
                <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover rounded-lg shadow-sm border border-gray-200" />
                <button 
                  type="button"
                  onClick={removeImage}
                  className="absolute top-2 right-2 bg-gray-900/70 backdrop-blur-sm text-white rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:bg-red-600 transition-colors duration-200"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center pointer-events-none py-4">
                <div className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center mb-3">
                  <UploadCloud size={24} className="text-red-500" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-gray-500">SVG, PNG, JPG or GIF (max. 5MB)</p>
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
        </div>

        <div className="flex items-center justify-end gap-3 pt-6 mt-2 border-t border-gray-100">
          <button 
            type="button" 
            className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors focus:outline-none"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
            onClick={(e) => handleSubmit(e)}
            disabled={submitting}
          >
            Save Draft
          </button>
          <button 
            type="submit" 
            className="px-6 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 flex items-center gap-2"
            onClick={(e) => handleSubmit(e)}
            disabled={submitting || !title || !body}
          >
            {submitting ? (initialData ? "Saving..." : "Publishing...") : (initialData ? "Save Changes" : "Publish Announcement")}
          </button>
        </div>
      </form>
    </div>
  );
};
