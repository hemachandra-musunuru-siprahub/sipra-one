import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock, Megaphone, ChevronLeft, ChevronRight } from "lucide-react";
import { getLatestAnnouncements } from "../api/announcements";
import type { Announcement } from "../api/types";

// Pure utility — called from event handlers, not during render
function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const diff = now.getTime() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Large Featured Card ──────────────────────────────────────────────────────
interface CardProps {
  ann: Announcement;
  onClick: () => void;
  getImageUrl: (url: string) => string;
}

const FeaturedUpdateCard = ({ ann, onClick, getImageUrl }: CardProps) => {

  return (
    <div
      onClick={onClick}
      className="w-full flex-shrink-0 flex items-stretch cursor-pointer group/card
                 bg-white hover:bg-gray-50/50 hover:scale-[1.01] hover:shadow-md transition-all duration-300
                 rounded-2xl border border-gray-100"
      style={{ height: "220px" }}
    >
      {/* Thumbnail (Left Side) */}
      <div className="w-1/3 min-w-[240px] max-w-[320px] h-full overflow-hidden flex-shrink-0 relative">
        {ann.image_url ? (
          <img
            src={getImageUrl(ann.image_url)}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              el.style.display = "none";
              el.parentElement!.innerHTML =
                '<div class="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg></div>';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center">
            <Megaphone size={40} className="text-red-300" />
          </div>
        )}
        {/* Subtle overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10" />
      </div>

      {/* Content (Right Side) */}
      <div className="flex-1 min-w-0 p-6 md:p-8 flex flex-col justify-center relative bg-gradient-to-r from-white to-gray-50/50">
        <div className="flex items-center gap-3 mb-3">
          {ann.category && (
            <span className="flex-shrink-0 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-red-50 text-red-700 border border-red-100">
              {ann.category}
            </span>
          )}
          {ann.is_pinned && (
             <span className="flex-shrink-0 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
               Pinned
             </span>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium ml-auto">
            <Clock size={14} />
            <span>{formatRelativeTime(ann.created_at)}</span>
          </div>
        </div>

        <h3 className="text-xl md:text-2xl font-bold text-gray-900 line-clamp-2 mb-3 leading-tight group-hover/card:text-red-600 transition-colors">
          {ann.title}
        </h3>
        
        <p className="text-sm md:text-base text-gray-600 line-clamp-2 leading-relaxed max-w-3xl">
          {ann.body}
        </p>

        <div className="mt-4 flex items-center text-sm font-semibold text-red-600 opacity-0 -translate-x-2 group-hover/card:opacity-100 group-hover/card:translate-x-0 transition-all duration-300">
          Read more <ArrowRight size={16} className="ml-1" />
        </div>
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
export const TopAnnouncementsCarousel = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const getImageUrl = (url: string) =>
    url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  // Fetch latest 5 announcements (sorted newest first, pinned first)
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await getLatestAnnouncements(5);
        // Sort: pinned first, then newest
        const sorted = [...(data.announcements || [])].sort((a, b) => {
          if (a.is_pinned === b.is_pinned)
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          return a.is_pinned ? -1 : 1;
        });
        setAnnouncements(sorted);
      } catch (err) {
        console.error("TopAnnouncementsCarousel: fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const total = announcements.length;

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((i) => (i + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setCurrentIndex((i) => (i - 1 + total) % total);
  }, [total]);

  // Auto-scroll: 4s, infinite loop, pause on hover
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isHovered || total <= 1) return;
    timerRef.current = setInterval(goNext, 4000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, goNext, total]);

  // ── Skeleton ──
  if (loading) {
    return (
      <div className="w-full bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden mb-8" style={{ height: "280px" }}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="flex h-full animate-pulse">
          <div className="w-1/3 min-w-[240px] bg-gray-100" />
          <div className="flex-1 p-8 space-y-4">
            <div className="flex gap-2"><div className="h-6 w-20 bg-gray-200 rounded-full" /></div>
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (total === 0) {
    return (
      <div className="w-full bg-white rounded-3xl border border-gray-200 shadow-sm mb-8 flex flex-col items-center justify-center" style={{ height: "220px" }}>
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <Megaphone size={28} className="text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Updates</h3>
        <p className="text-sm font-medium text-gray-500">There are currently no company announcements.</p>
      </div>
    );
  }

  return (
    <div
      className="w-full bg-white rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-gray-200 overflow-hidden mb-8 group/carousel relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Header ── */}
      <div className="px-6 py-4 border-b border-gray-100 bg-white flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
             <Megaphone size={16} className="text-red-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">Featured Announcements</h2>
          {total > 1 && (
            <span className="text-xs text-gray-500 font-semibold ml-2 px-2 py-0.5 bg-gray-100 rounded-md">
              {currentIndex + 1} / {total}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Arrow nav — only when multiple items */}
          {total > 1 && (
            <div className="flex items-center gap-1.5 opacity-0 group-hover/carousel:opacity-100 transition-opacity">
              <button
                onClick={goPrev}
                className="p-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-600 transition-all shadow-sm"
                aria-label="Previous"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={goNext}
                className="p-1.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-gray-600 transition-all shadow-sm"
                aria-label="Next"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <button
            onClick={() => navigate("/announcements")}
            className="text-sm font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors group/link"
          >
            View All
            <ArrowRight size={14} className="group-hover/link:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* ── Sliding area ── */}
      <div className="relative overflow-hidden bg-white">
        {/* Slide track */}
        <div
          className="flex transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {announcements.map((ann) => (
            <div key={ann.id} className="w-full flex-shrink-0">
              <FeaturedUpdateCard
                ann={ann}
                onClick={() => navigate(`/announcements/${ann.id}`)}
                getImageUrl={getImageUrl}
              />
            </div>
          ))}
        </div>

        {/* Progress bar (auto-scroll indicator) */}
        {total > 1 && !isHovered && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-transparent z-10">
            <div
              key={currentIndex} // re-triggers animation on slide change
              className="h-full bg-red-500 rounded-r-full"
              style={{ animation: "progress-fill 4s linear forwards" }}
            />
          </div>
        )}

        {/* Floating Indicator Dots overlayed on bottom center */}
        {total > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-gray-200/50 shadow-sm">
            {announcements.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`rounded-full transition-all duration-300 ${
                  idx === currentIndex
                    ? "bg-red-600 w-6 h-1.5"
                    : "bg-gray-300 hover:bg-gray-400 w-1.5 h-1.5"
                }`}
                aria-label={`Go to update ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Keyframe for progress bar */}
      <style>{`
        @keyframes progress-fill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};
