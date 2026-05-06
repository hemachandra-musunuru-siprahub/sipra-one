import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Plus, Search, Filter, Megaphone, Archive } from "lucide-react";
import { useAnnouncements } from "../../components/hooks/useAnnouncements";
import { AnnouncementCard } from "../../components/AnnouncementCard";
import { AnnouncementForm } from "../../components/AnnouncementForm";
import { reactToAnnouncement, deleteAnnouncement } from "../../api/announcements";
import type { Announcement } from "../../api/types";

import { normalizeRole } from "../../lib/roleHelper";
import type { UserRole } from "../../lib/roleHelper";

interface Props { internalUser: any; isHR?: boolean; role?: string; }



export const AnnouncementsPage = ({ internalUser, isHR = false, role }: Props) => {
  const [showDrafts, setShowDrafts] = useState(false);

  // Two separate data sources — published feed and draft feed
  const {
    announcements: published,
    loading: publishedLoading,
    hasMore: publishedHasMore,
    loadMore: loadMorePublished,
    refresh: refreshPublished,
    setAnnouncements: setPublished,
  } = useAnnouncements(1, 20, "published");

  const {
    announcements: drafts,
    loading: draftsLoading,
    refresh: refreshDrafts,
    setAnnouncements: setDrafts,
  } = useAnnouncements(1, 50, "draft");

  // Active list based on current view
  const announcements = showDrafts ? drafts : published;
  const setAnnouncements = showDrafts ? setDrafts : setPublished;
  const loading = showDrafts ? draftsLoading : publishedLoading;
  const hasMore = showDrafts ? false : publishedHasMore;
  const loadMore = showDrafts ? () => {} : loadMorePublished;

  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reactionError, setReactionError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  // Auto-scroll to highlighted post
  useEffect(() => {
    if (highlightId && !loading && announcements.length > 0) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`announcement-${highlightId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [highlightId, loading, announcements.length]);

  const handleReact = async (id: string, reactionType: string) => {
    const ann = announcements.find(a => a.id === id);
    if (!ann) return;

    // Snapshot for rollback
    const previousAnnouncements = [...announcements];

    // Optimistic Logic
    const oldReaction = ann.user_reaction;
    const isUndo = oldReaction === reactionType;
    const nextReactions = { ...ann.reactions };

    if (isUndo) {
      nextReactions[reactionType] = Math.max(0, (nextReactions[reactionType] || 1) - 1);
    } else {
      if (oldReaction) {
        nextReactions[oldReaction] = Math.max(0, (nextReactions[oldReaction] || 1) - 1);
      }
      nextReactions[reactionType] = (nextReactions[reactionType] || 0) + 1;
    }

    // Apply optimistic update
    setAnnouncements(prev => prev.map(a => 
      a.id === id ? { ...a, reactions: nextReactions, user_reaction: isUndo ? null : reactionType } : a
    ));

    try {
      console.debug(`[Reaction] POST /api/announcements/${id}/reactions`, { reactionType });
      // Sync with API (POST handles toggle in backend)
      const result = await reactToAnnouncement(id, reactionType);
      console.debug(`[Reaction] Server response:`, result);

      // Guard: only update if server returned valid data
      if (result?.reactions_count !== undefined) {
        setAnnouncements(prev => prev.map(a => 
          a.id === id ? { ...a, reactions: result.reactions_count, user_reaction: result.user_reaction } : a
        ));
      } else {
        // Unexpected shape — rollback and warn
        console.error("[Reaction] Unexpected server response shape:", result);
        setAnnouncements(previousAnnouncements);
      }
    } catch (e) {
      console.error("[Reaction] Failed, rolling back:", e);
      setAnnouncements(previousAnnouncements);
      setReactionError("Could not save your reaction. Please try again.");
      setTimeout(() => setReactionError(null), 3500);
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    
    // Optimistic delete
    const previous = [...announcements];
    setAnnouncements(prev => prev.filter(a => a.id !== id));
    
    try {
      await deleteAnnouncement(id);
    } catch (e) {
      console.error("Delete failed, rolling back:", e);
      setAnnouncements(previous);
      alert("Failed to delete announcement.");
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingAnnouncement(null);
    // Refresh both lists since a draft could have been published or vice versa
    refreshPublished();
    refreshDrafts();
  };

  const layoutRole: UserRole = useMemo(() => {
    if (role) return normalizeRole(role);
    const userRoles = internalUser?.roles || [];
    if (userRoles.some((r: string) => ["Admin", "SipraHub-SystemAdmin"].includes(r))) return "Admin";
    if (userRoles.some((r: string) => ["HR", "SipraHub-HR"].includes(r)) || isHR) return "HR";
    if (userRoles.some((r: string) => ["Manager", "SipraHub-Manager"].includes(r))) return "Manager";
    return "Employee";
  }, [role, internalUser, isHR]);

  const filteredAnnouncements = useMemo(() => {
    return announcements
      .filter(ann => {
        const matchesSearch = ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             ann.body.toLowerCase().includes(searchQuery.toLowerCase());
        
        return matchesSearch;
      })
      .sort((a, b) => {
        // Pinned posts first
        if (a.is_pinned !== b.is_pinned) {
          return a.is_pinned ? -1 : 1;
        }
        // Then newest first
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [announcements, searchQuery]);

  // Stats — always from published feed
  const stats = useMemo(() => {
    return {
      total: published.length,
      pinned: published.filter(a => a.is_pinned).length,
      draftsCount: drafts.length,
      thisWeek: published.filter(a => {
        const diff = new Date().getTime() - new Date(a.created_at).getTime();
        return diff < 7 * 24 * 60 * 60 * 1000;
      }).length
    };
  }, [published, drafts]);


  return (
    <DashboardLayout internalUser={internalUser} role={layoutRole}>
      {/* Reaction Error Toast */}
      {reactionError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-medium px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {reactionError}
        </div>
      )}
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Company Announcements</h1>
            <p className="text-sm text-gray-500 mt-0.5">Latest updates from HR & teams</p>
          </div>
          
          <div className="flex items-center justify-center gap-6 w-full">
            <div className="relative w-64 flex-shrink-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search updates..." 
                className="w-full pl-9 pr-3 h-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Overview Stats */}
            <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100 flex-shrink-0">
              <div className="flex flex-col items-center justify-center min-w-[80px] px-3 py-1 bg-white rounded-lg border border-gray-100 shadow-sm">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">Published</span>
                <span className="text-sm font-bold text-gray-900">{stats.total}</span>
              </div>
              <div className="flex flex-col items-center justify-center min-w-[80px] px-3 py-1 bg-white rounded-lg border border-gray-100 shadow-sm">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">This Week</span>
                <span className="text-sm font-bold text-gray-900">{stats.thisWeek}</span>
              </div>
              {isHR && (
                <div className={`flex flex-col items-center justify-center min-w-[80px] px-3 py-1 rounded-lg border shadow-sm transition-colors ${
                  stats.draftsCount > 0 ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-white border-gray-100 text-gray-400"
                }`}>
                  <span className={`text-[10px] font-bold uppercase tracking-tight ${stats.draftsCount > 0 ? "text-amber-600" : "text-gray-400"}`}>Drafts</span>
                  <span className="text-sm font-bold">{stats.draftsCount}</span>
                </div>
              )}
            </div>
            
            {isHR && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                  onClick={() => setShowDrafts(!showDrafts)}
                  className={`flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-sm font-medium transition-colors border ${
                    showDrafts 
                      ? "bg-gray-900 text-white border-gray-900" 
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <Archive size={16} strokeWidth={2.5} /> 
                  <span>{showDrafts ? "View Published" : "View Drafts"}</span>
                </button>

                <button 
                  className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white h-10 px-4 rounded-lg text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                  onClick={() => { setEditingAnnouncement(null); setShowForm(true); }}
                >
                  <Plus size={16} strokeWidth={2.5} /> 
                  <span>Create Post</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 gap-6">
          
          {/* Feed */}
          <div className="flex flex-col gap-6">
            
            {/* Recent Updates Section */}


            <section className="flex flex-col gap-4">
              {/* View indicator */}
              {showDrafts && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <Archive size={14} className="text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">Viewing Drafts — only visible to HR</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {showDrafts ? "Draft Announcements" : searchQuery ? "Search Results" : "Recent Updates"}
                </h2>
                <span className="text-sm font-medium text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-md">
                  {filteredAnnouncements.length}
                </span>
              </div>
              
              {loading && filteredAnnouncements.length === 0 ? (
                <div className="flex flex-col gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-gray-200 animate-pulse h-32"></div>
                  ))}
                </div>
              ) : filteredAnnouncements.length === 0 ? (
                <div className="bg-white p-8 rounded-xl border border-gray-200 text-center flex flex-col items-center justify-center">
                  <Archive size={32} className={`mb-3 ${showDrafts ? "text-amber-300" : "text-gray-300"}`} />
                  <h3 className="text-base font-semibold text-gray-900">
                    {showDrafts ? "No drafts found" : "No updates found"}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {showDrafts 
                      ? "Save a post as draft to see it here." 
                      : searchQuery ? `No results for "${searchQuery}".` : "There are currently no announcements."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredAnnouncements.map(ann => (
                    <AnnouncementCard 
                      key={ann.id} 
                      announcement={ann} 
                      onReact={handleReact}
                      canEdit={isHR}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isHighlighted={ann.id === highlightId}
                    />
                  ))}
                </div>
              )}

              {hasMore && !loading && !searchQuery && (
                <button 
                  className="w-full py-2.5 mt-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none"
                  onClick={loadMore}
                >
                  Load More
                </button>
              )}
            </section>
          </div>


        </div>
      </div>

      {/* Form Modal Overlay */}
      {isHR && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-gray-900/40 transition-all">
          <div 
            className="absolute inset-0" 
            onClick={() => { setShowForm(false); setEditingAnnouncement(null); }} 
            aria-label="Close modal"
          ></div>
          <div className="relative w-full max-w-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
            <AnnouncementForm 
              onSuccess={handleFormSuccess}
              onCancel={() => { setShowForm(false); setEditingAnnouncement(null); }}
              initialData={editingAnnouncement || undefined}
            />
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

