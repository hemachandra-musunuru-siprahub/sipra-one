import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock, Megaphone } from "lucide-react";
import { getLatestAnnouncements } from "../api/announcements";
import type { Announcement } from "../api/types";

interface CompactCardProps {
  announcement: Announcement;
  onClick: (id: string) => void;
  getImageUrl: (url: string) => string;
}

const CompactAnnouncementCard = ({ announcement, onClick, getImageUrl }: CompactCardProps) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  return (
    <div 
      onClick={() => onClick(announcement.id)}
      className="w-full h-full flex-shrink-0 flex items-center p-4 cursor-pointer hover:bg-gray-50 transition-all duration-300 group/card hover:shadow-md border border-transparent hover:border-gray-100 rounded-xl"
    >
      {announcement.image_url ? (
        <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 mr-4 hidden sm:block">
          <img 
            src={getImageUrl(announcement.image_url)} 
            alt="" 
            className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-110" 
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
        </div>
      ) : (
        <div className="w-16 h-16 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 mr-4 hidden sm:block border border-gray-100">
          <Megaphone className="text-gray-300" size={24} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-gray-900 truncate group-hover/card:text-red-600 transition-colors mb-1">
          {announcement.title}
        </h4>
        <p className="text-xs text-gray-500 line-clamp-2 mb-2">
          {announcement.body}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium">
          <Clock size={10} />
          <span>{formatDate(announcement.created_at)}</span>
        </div>
      </div>
    </div>
  );
};

export const AnnouncementWidget = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const getImageUrl = (url: string) => url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLatestAnnouncements(3);
      setAnnouncements(data.announcements);
    } catch (err) {
      console.error("Failed to fetch latest announcements:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const nextSlide = useCallback(() => {
    if (announcements.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % announcements.length);
  }, [announcements.length]);

  useEffect(() => {
    if (isHovered || announcements.length <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(nextSlide, 3000); // 3 second delay as requested
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered, nextSlide, announcements.length]);

  const handleCardClick = (id: string) => {
    navigate(`/announcements/${id}`);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm animate-pulse">
        <div className="h-5 w-32 bg-gray-200 rounded mb-4"></div>
        <div className="h-24 bg-gray-100 rounded-lg"></div>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm text-center">
        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
          <Megaphone className="text-gray-400" size={24} />
        </div>
        <p className="text-sm text-gray-500 font-medium">No updates available</p>
      </div>
    );
  }

  return (
    <div 
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col transition-all duration-300"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Widget Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-red-600" />
          <h3 className="text-sm font-semibold text-gray-900">Latest Updates</h3>
        </div>
        <button 
          onClick={() => navigate("/announcements")}
          className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1 transition-colors group"
        >
          View All
          <ArrowRight size={12} className="group-hover/translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Slider Area */}
      <div className="relative overflow-hidden h-[120px]">
        <div 
          className="flex transition-transform duration-500 ease-in-out h-full"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {announcements.map((ann) => (
            <CompactAnnouncementCard 
              key={ann.id}
              announcement={ann}
              onClick={handleCardClick}
              getImageUrl={getImageUrl}
            />
          ))}
        </div>

        {/* Indicators */}
        {announcements.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {announcements.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-1 rounded-full transition-all duration-300 ${
                  idx === currentIndex ? "bg-red-500 w-4" : "bg-gray-200 w-1.5 hover:bg-gray-300"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
