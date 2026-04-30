import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, User, Tag, Share2 } from "lucide-react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { api } from "../../api/client";
import type { Announcement } from "../../api/types";

export const AnnouncementDetailPage = ({ internalUser }: { internalUser: any }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);

  // Determine role for DashboardLayout
  const roles = internalUser?.roles || [];
  const role: "Admin" | "HR" | "Manager" | "Employee" = 
    roles.includes("Admin") || roles.includes("SipraHub-SystemAdmin") ? "Admin" :
    roles.includes("HR") || roles.includes("SipraHub-HR") ? "HR" :
    roles.includes("Manager") || roles.includes("SipraHub-Manager") ? "Manager" : "Employee";

  const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
  const getImageUrl = (url: string) => url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        setLoading(true);
        const data = await api.get<{ announcement: Announcement }>(`/api/announcements/${id}`);
        // If the backend doesn't have a single GET, we might need to fetch all and filter or add the route.
        // Let's assume we'll add the route to the backend.
        setAnnouncement(data.announcement);
      } catch (err) {
        console.error("Failed to fetch announcement:", err);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchAnnouncement();
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout internalUser={internalUser} role={role}>
        <div className="max-w-4xl mx-auto p-6 animate-pulse">
          <div className="h-8 w-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-96 bg-gray-100 rounded-xl mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!announcement) {
    return (
      <DashboardLayout internalUser={internalUser} role={role}>
        <div className="max-w-4xl mx-auto p-6 text-center py-20">
          <h2 className="text-2xl font-bold text-gray-900">Announcement not found</h2>
          <button onClick={() => navigate(-1)} className="mt-4 text-red-600 font-medium hover:underline">
            Go back
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout internalUser={internalUser} role={role}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Navigation */}
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-8 group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to feed</span>
        </button>

        <article className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Cover Image */}
          {announcement.image_url && (
            <div className="w-full h-80 overflow-hidden border-b border-gray-100">
              <img 
                src={getImageUrl(announcement.image_url)} 
                alt={announcement.title} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
            </div>
          )}

          <div className="p-8 md:p-12">
            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              <span className="px-3 py-1 bg-red-50 text-red-700 text-xs font-bold uppercase tracking-wider rounded-full border border-red-100">
                {announcement.category || "General"}
              </span>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <Calendar size={16} />
                <span>{new Date(announcement.created_at).toLocaleDateString("en-US", { dateStyle: "long" })}</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-gray-500">
                <User size={16} />
                <span>{announcement.author_name || "HR Team"}</span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 leading-tight">
              {announcement.title}
            </h1>

            {/* Content */}
            <div className="prose prose-red max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
              {announcement.body}
            </div>

            {/* Footer */}
            <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center font-bold">
                  {(announcement.author_name || "H").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{announcement.author_name || "HR Team"}</p>
                  <p className="text-xs text-gray-500">Corporate Communications</p>
                </div>
              </div>
              <button className="p-2 hover:bg-gray-50 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </article>
      </div>
    </DashboardLayout>
  );
};
