import React, { useState } from "react";
import type { Announcement } from "../api/types";
import { Pin, MessageSquare } from "lucide-react";

interface Props {
  announcement: Announcement;
  onReact?: (id: string, reactionType: string) => void;
  featured?: boolean;
  canEdit?: boolean;
  onEdit?: (announcement: Announcement) => void;
  onDelete?: (id: string) => void;
  isHighlighted?: boolean;
}

const REACTIONS = [
  { type: "thumbs_up", icon: "👍" },
  { type: "heart", icon: "❤️" },
  { type: "laugh", icon: "😄" },
  { type: "surprised", icon: "😮" },
  { type: "sad", icon: "😢" },
];

export const AnnouncementCard = React.memo(({ announcement, onReact, canEdit, onEdit, onDelete, featured, isHighlighted }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const getImageUrl = (url: string) => url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  const getRelativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  };

  const authorName = announcement.author_name || "HR Team";
  const initial = authorName.charAt(0).toUpperCase();
  const isPinned = announcement.is_pinned;

  if (featured && announcement.image_url) {
    return (
      <div className="card group/card bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
        <div className="image-wrapper relative overflow-hidden h-[240px] w-full">
          <img 
            src={getImageUrl(announcement.image_url)} 
            alt="Featured Announcement" 
            className="w-full h-full object-cover transition-transform duration-700 group-hover/card:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
          
          <div 
            className="image-overlay absolute inset-0 z-10 p-4 flex flex-col justify-between"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)" }}
          >
            {/* Header section inside image */}
            <div className="flex justify-between items-start w-full gap-4">
              <h3 
                className="text-white font-bold text-lg md:text-xl line-clamp-1 flex-1"
                style={{ textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
              >
                {announcement.title}
              </h3>

              <div className="tags flex items-center gap-2 flex-shrink-0">
                {isPinned && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-600 text-white shadow-sm">
                    Pinned
                  </span>
                )}
              </div>
            </div>

            {/* Bottom section inside image */}
            <div className="flex flex-col gap-3">
              <p 
                className="text-white/90 text-sm md:text-base line-clamp-2 max-w-[90%]"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
              >
                {announcement.body}
              </p>

              <div className="reactions flex justify-center w-full">
                <div 
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full shadow-lg backdrop-blur-md border border-white/20 pointer-events-auto"
                  style={{ background: "rgba(255,255,255,0.95)" }}
                  onClick={(e) => e.stopPropagation()} 
                >
                  {REACTIONS.map((r) => {
                    const count = announcement.reactions?.[r.type] || 0;
                    const isActive = announcement.user_reaction === r.type;
                    
                    return (
                      <button 
                        key={r.type} 
                        onClick={(e) => { e.stopPropagation(); onReact?.(announcement.id, r.type); }}
                        className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-all ${
                          isActive 
                            ? "bg-red-50 text-red-600 font-bold scale-105" 
                            : "hover:bg-gray-100 text-gray-700"
                        }`}
                      >
                        <span className="text-sm">{r.icon}</span>
                        {count > 0 && <span className="font-semibold">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content remains clean */}
        <div className="content">
          {canEdit && (
             <div className="px-4 py-2 flex justify-end border-t border-gray-100 bg-gray-50/50">
                <button 
                  onClick={() => onEdit?.(announcement)}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1"
                >
                  Edit Post
                </button>
             </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div 
      id={`announcement-${announcement.id}`}
      className={`bg-white border rounded-xl p-4 hover:shadow-md transition flex flex-col gap-3 ${
        isHighlighted 
          ? "border-red-500 ring-4 ring-red-500/10 shadow-lg scale-[1.01]" 
          : "border-gray-200"
      }`}
    >
      {/* Row 1: Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-semibold text-gray-700 border border-gray-200">
            {initial}
          </div>
          <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900">{authorName}</span>
            <span className="text-xs text-gray-500 mt-0.5">
              {getRelativeTime(announcement.created_at)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 relative">
          {announcement.status === "draft" && (
            <span className="px-2 py-0.5 text-xs font-bold rounded-md bg-amber-100 text-amber-700 border border-amber-300 uppercase tracking-wide">
              Draft
            </span>
          )}
          {isPinned && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1">
              <Pin size={12} fill="currentColor" /> Pinned
            </span>
          )}
          {canEdit && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-1 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-8 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit?.(announcement); }}
                    className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Edit
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete?.(announcement.id); }}
                    className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Title & Body */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold text-gray-900">
          {announcement.title}
        </h3>
        
        {expanded ? (
          <div className="text-sm text-gray-600 whitespace-pre-wrap">
            {announcement.body}
            <button onClick={(e) => { e.stopPropagation(); setExpanded(false); }} className="text-blue-600 font-medium ml-1 hover:underline">
              Show less
            </button>
          </div>
        ) : (
          <div className="text-sm text-gray-600 line-clamp-2">
            {announcement.body}
          </div>
        )}
        
        {!expanded && announcement.body.length > 120 && (
          <button onClick={(e) => { e.stopPropagation(); setExpanded(true); }} className="text-xs text-blue-600 font-medium self-start hover:underline mt-0.5">
            Read more
          </button>
        )}
      </div>

      {/* Optional Image */}
      {announcement.image_url && (
        <div className="w-full h-48 rounded-lg overflow-hidden border border-gray-200 mt-1">
          <img 
            src={getImageUrl(announcement.image_url)} 
            alt="Announcement" 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Footer: Reactions */}
      <div className="flex items-center gap-2 mt-2 pt-3 border-t border-gray-100">
        {REACTIONS.map((r) => {
          const count = announcement.reactions?.[r.type] || 0;
          const isActive = announcement.user_reaction === r.type;
          
          return (
            <button 
              key={r.type} 
              onClick={(e) => { e.stopPropagation(); onReact?.(announcement.id, r.type); }}
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                isActive 
                  ? "bg-red-50 text-red-600 border-red-200" 
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span>{r.icon}</span>
              {count > 0 && <span className={isActive ? "text-red-700 font-bold" : "text-gray-500"}>{count}</span>}
            </button>
          );
        })}
        
      </div>
    </div>
  );
});
