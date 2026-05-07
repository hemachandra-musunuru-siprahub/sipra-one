import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Megaphone, ChevronLeft, ChevronRight } from "lucide-react";
import { getLatestAnnouncements, reactToAnnouncement, removeReaction } from "../api/announcements";
import type { Announcement } from "../api/types";

const REACTIONS = [
  { type: "thumbs_up", icon: "👍" },
  { type: "heart", icon: "❤️" },
  { type: "laugh", icon: "😄" },
  { type: "surprised", icon: "😮" },
  { type: "sad", icon: "😢" },
];

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
      className="w-full flex-shrink-0 cursor-pointer group/card overflow-hidden transition-all duration-300 flex flex-col"
    >
      {/* ── Image Area ── */}
      <div className="relative h-[280px] sm:h-[320px] w-full flex-shrink-0 bg-gray-100 overflow-hidden">
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

        {/* Featured Badge Overlay */}
        {ann.is_pinned && (
          <div className="absolute top-4 right-4 z-20">
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-red-600 shadow-sm border border-red-100">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              Featured
            </span>
          </div>
        )}

        {/* Reaction Picker Overlay */}
        <div className={`absolute bottom-4 left-4 z-20 transition-all duration-300 transform ${showReactions ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
          <div
            className="flex items-center gap-1 p-1.5 rounded-full shadow-xl backdrop-blur-xl border border-white/30"
            style={{ background: "rgba(255,255,255,0.85)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {REACTIONS.map((r) => {
              const count = ann.reactions?.[r.type] || 0;
              const isActive = ann.user_reaction === r.type;
              return (
                <button
                  key={r.type}
                  onClick={(e) => { e.stopPropagation(); onReact(ann.id, r.type); }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full transition-all ${isActive
                    ? "bg-red-500 text-white font-bold scale-110"
                    : "hover:bg-gray-100 text-gray-700"
                    }`}
                  title={r.type}
                >
                  <span className="text-sm">{r.icon}</span>
                  {count > 0 && <span className={isActive ? "text-white" : "text-gray-500"}>{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Content Area ── */}
      <div className="p-5 sm:p-6 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-red-600 uppercase tracking-wider">
          <Clock size={12} />
          {new Date(ann.created_at || "").toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 line-clamp-1 group-hover/card:text-red-600 transition-colors leading-tight">
          {ann.title}
        </h3>
        {ann.body && (
          <p className="text-base text-gray-500 line-clamp-2 leading-relaxed">
            {ann.body}
          </p>
        )}
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

  const currentPath = window.location.pathname;
  let basePath = "/employee";
  if (currentPath.startsWith("/hr")) basePath = "/hr";
  else if (currentPath.startsWith("/manager")) basePath = "/manager";

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const getImageUrl = (url: string) =>
    url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  useEffect(() => {
    const fetch = async () => {
      try {
        setLoading(true);
        const data = await getLatestAnnouncements(20);
        const featured = (data.announcements || [])
          .filter(a => (a.status === "published" || !a.status) && a.is_pinned === true)
          .slice(0, 5);
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
      setAnnouncements(prev => prev.map(ann => {
        if (ann.id !== id) return ann;
        const currentReaction = ann.user_reaction;
        const reactions = { ...ann.reactions };
        if (currentReaction === reactionType) {
          reactions[reactionType] = Math.max(0, (reactions[reactionType] || 1) - 1);
          return { ...ann, user_reaction: null, reactions };
        } else {
          if (currentReaction) {
            reactions[currentReaction] = Math.max(0, (reactions[currentReaction] || 1) - 1);
          }
          reactions[reactionType] = (reactions[reactionType] || 0) + 1;
          return { ...ann, user_reaction: reactionType, reactions };
        }
      }));

      const target = announcements.find(a => a.id === id);
      if (target?.user_reaction === reactionType) {
        await removeReaction(id);
      } else {
        await reactToAnnouncement(id, reactionType);
      }
    } catch (err) {
      console.error("Reaction failed:", err);
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

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (isHovered || total <= 1) return;
    timerRef.current = setInterval(goNext, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, goNext, total]);

  if (loading) {
    return (
      <div className="w-full bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-8">
        <div className="p-32 flex flex-col items-center justify-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-full bg-gray-100" />
          <div className="h-6 w-48 bg-gray-100 rounded-full" />
        </div>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="w-full bg-white rounded-3xl border border-gray-100 shadow-sm mb-8 p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <Megaphone size={28} className="text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">No Featured Updates</h3>
        <p className="text-sm text-gray-500 max-w-xs">Check back later for important announcements and company news.</p>
      </div>
    );
  }

  return (
    <div
      className="w-full bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden mb-8 group/carousel relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Header ── */}
      <div className="px-6 py-5 flex items-center justify-between border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shadow-inner">
            <Megaphone size={18} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Featured Updates</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                {total} Handpicked News
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {total > 1 && (
            <div className="hidden sm:flex items-center gap-2 mr-4">
              <button
                onClick={goPrev}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 hover:bg-red-50 hover:text-red-600 text-gray-400 transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={goNext}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 hover:bg-red-50 hover:text-red-600 text-gray-400 transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          <button
            onClick={() => navigate(`${basePath}/announcements`)}
            className="px-4 py-2 rounded-full bg-red-50 text-red-600 text-sm font-bold hover:bg-red-600 hover:text-white transition-all duration-300"
          >
            View All
          </button>
        </div>
      </div>

      {/* ── Sliding area ── */}
      <div className="relative">
        <div
          className="flex transition-transform duration-700 ease-[cubic-bezier(0.2,1,0.3,1)]"
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

        {/* Progress bar overlay (auto-scroll) */}
        {total > 1 && !isHovered && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-50 z-10 overflow-hidden">
            <div
              key={currentIndex}
              className="h-full bg-red-600"
              style={{ animation: "progress-fill 5s linear forwards" }}
            />
          </div>
        )}
      </div>

      {/* ── Footer / Pagination ── */}
      {total > 1 && (
        <div className="px-6 py-6 border-t border-gray-50 flex items-center justify-center">
          <div className="flex items-center gap-2.5">
            {announcements.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`transition-all duration-500 rounded-full ${idx === currentIndex
                  ? "w-8 h-2 bg-red-600"
                  : "w-2 h-2 bg-gray-200 hover:bg-gray-300"
                  }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes progress-fill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};
