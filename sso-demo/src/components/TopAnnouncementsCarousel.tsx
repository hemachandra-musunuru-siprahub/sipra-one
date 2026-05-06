import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock, Megaphone, ChevronLeft, ChevronRight } from "lucide-react";
import { getLatestAnnouncements, reactToAnnouncement, removeReaction } from "../api/announcements";
import type { Announcement } from "../api/types";

const REACTIONS = [
  { type: "thumbs_up", icon: "👍" },
  { type: "heart", icon: "❤️" },
  { type: "laugh", icon: "😄" },
  { type: "surprised", icon: "😮" },
  { type: "sad", icon: "😢" },
];

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
  onReact: (id: string, type: string) => void;
}

const FeaturedUpdateCard = ({ ann, onClick, getImageUrl, onReact }: CardProps) => {
  const [showReactions, setShowReactions] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setShowReactions(true)}
      onMouseLeave={() => setShowReactions(false)}
      className="w-full h-full flex-shrink-0 cursor-pointer group/card relative overflow-hidden rounded-2xl border border-gray-100 bg-white transition-all duration-300 hover:shadow-md flex flex-col"
    >
      <div className="image-wrapper relative overflow-hidden h-[200px] w-full flex-shrink-0">
        {/* Background Image */}
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
            <Megaphone size={64} className="text-red-300 opacity-50" />
          </div>
        )}
        
        {/* Overlay layer - Restricted to image-wrapper */}
        <div 
          className="image-overlay absolute inset-0 z-10 p-4 flex flex-col justify-between"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 100%)" }}
        >
          <div className="flex justify-end items-start w-full">
            {ann.is_pinned && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white shadow-sm">
                Pinned
              </span>
            )}
          </div>

          <div className={`flex justify-start transition-all duration-300 transform ${showReactions ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            <div 
              className="flex items-center gap-1 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md border border-white/20 pointer-events-auto"
              style={{ background: "rgba(255,255,255,0.95)" }}
              onClick={(e) => e.stopPropagation()} 
            >
              {REACTIONS.map((r) => {
                const count = ann.reactions?.[r.type] || 0;
                const isActive = ann.user_reaction === r.type;
                
                return (
                  <button 
                    key={r.type} 
                    onClick={(e) => { e.stopPropagation(); onReact(ann.id, r.type); }}
                    className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-all ${
                      isActive 
                        ? "bg-red-50 text-red-600 font-bold scale-105" 
                        : "hover:bg-gray-100 text-gray-700"
                    }`}
                    title={r.type}
                  >
                    <span className="text-sm">{r.icon}</span>
                    {count > 0 && <span className="font-semibold text-red-700">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="post-content p-4 flex flex-col gap-2">
        <h3 className="text-lg font-bold text-gray-900 line-clamp-1 group-hover/card:text-red-600 transition-colors">
          {ann.title}
        </h3>
        {ann.body && (
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
            {ann.body}
          </p>
        )}
      </div>

      {/* Content div - remains clean as requested */}
      <div className="content">
        {/* Optional non-overlay content could go here if needed in future */}
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

  // Determine the correct base path for navigation
  const currentPath = window.location.pathname;
  let basePath = "/employee";
  if (currentPath.startsWith("/hr")) basePath = "/hr";
  else if (currentPath.startsWith("/manager")) basePath = "/manager";

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const getImageUrl = (url: string) =>
    url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  // Fetch latest 5 published announcements (sorted newest first, pinned first)
  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        // We fetch a larger batch to ensure we find enough pinned posts, or keep it simple
        const data = await getLatestAnnouncements(20);
        // Filter: ONLY pinned AND published
        const featured = (data.announcements || []).filter(a => 
          (a.status === "published" || !a.status) && a.is_pinned === true
        );
        console.log("Featured (Pinned) posts:", featured);
        setAnnouncements(featured);
      } catch (err) {
        console.error("TopAnnouncementsCarousel: fetch failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  const handleReact = async (id: string, reactionType: string) => {
    try {
      // Optimistic update
      setAnnouncements(prev => prev.map(ann => {
        if (ann.id !== id) return ann;
        const currentReaction = ann.user_reaction;
        const reactions = { ...ann.reactions };
        
        if (currentReaction === reactionType) {
          // Toggle off
          reactions[reactionType] = Math.max(0, (reactions[reactionType] || 1) - 1);
          return { ...ann, user_reaction: null, reactions };
        } else {
          // Switch or add
          if (currentReaction) {
            reactions[currentReaction] = Math.max(0, (reactions[currentReaction] || 1) - 1);
          }
          reactions[reactionType] = (reactions[reactionType] || 0) + 1;
          return { ...ann, user_reaction: reactionType, reactions };
        }
      }));

      // API call
      const target = announcements.find(a => a.id === id);
      if (target?.user_reaction === reactionType) {
        await removeReaction(id);
      } else {
        await reactToAnnouncement(id, reactionType);
      }
    } catch (err) {
      console.error("Reaction failed:", err);
      // Revert optimism by refetching on error could be added here
    }
  };

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
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No Featured Updates</h3>
        <p className="text-sm font-medium text-gray-500">No featured announcements available at this time.</p>
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
            onClick={() => navigate(`${basePath}/announcements`)}
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
                onClick={() => navigate(`${basePath}/announcements?highlight=${ann.id}`)}
                getImageUrl={getImageUrl}
                onReact={handleReact}
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
                className={`rounded-full transition-all duration-300 ${idx === currentIndex
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
