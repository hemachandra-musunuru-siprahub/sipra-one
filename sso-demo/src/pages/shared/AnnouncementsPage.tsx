import React, { useState, useMemo } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { Plus, Search, Filter, Megaphone, CheckCircle2, CalendarDays, Archive } from "lucide-react";
import { useAnnouncements } from "../../components/hooks/useAnnouncements";
import { AnnouncementCard } from "../../components/AnnouncementCard";
import { AnnouncementForm } from "../../components/AnnouncementForm";
import { reactToAnnouncement, deleteAnnouncement } from "../../api/announcements";
import type { Announcement } from "../../api/types";

interface Props { internalUser: any; isHR?: boolean; roleOverride?: "Admin" | "HR" | "Manager" | "Employee"; }

export const AnnouncementsPage = ({ internalUser, isHR = false, roleOverride }: Props) => {
  const { announcements, loading, hasMore, loadMore, refresh, setAnnouncements } = useAnnouncements(1, 20);
  const [showForm, setShowForm] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

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
      // Sync with API (POST handles toggle in backend)
      const result = await reactToAnnouncement(id, reactionType);
      
      // Update with final server state
      setAnnouncements(prev => prev.map(a => 
        a.id === id ? { ...a, reactions: result.reactions_count, user_reaction: result.user_reaction } : a
      ));
    } catch (e) {
      console.error("Reaction failed, rolling back:", e);
      setAnnouncements(previousAnnouncements);
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
    refresh();
  };

  const displayRole = useMemo(() => {
    if (roleOverride) return roleOverride;
    const userRoles = internalUser?.roles || [];
    if (userRoles.some((r: string) => ["Admin", "SipraHub-SystemAdmin"].includes(r))) return "Admin";
    if (userRoles.some((r: string) => ["HR", "SipraHub-HR"].includes(r)) || isHR) return "HR";
    if (userRoles.some((r: string) => ["Manager", "SipraHub-Manager"].includes(r))) return "Manager";
    return "Employee";
  }, [roleOverride, internalUser, isHR]);

  // Filter announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter(ann => {
      const matchesSearch = ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           ann.body.toLowerCase().includes(searchQuery.toLowerCase());
      
      if (displayRole === "Employee") return matchesSearch;

      const matchesCategory = activeCategory === "All" || ann.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [announcements, searchQuery, activeCategory, displayRole]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: announcements.length,
      pinned: announcements.filter(a => a.is_pinned).length,
      thisWeek: announcements.filter(a => {
        const diff = new Date().getTime() - new Date(a.created_at).getTime();
        return diff < 7 * 24 * 60 * 60 * 1000;
      }).length
    };
  }, [announcements]);

  const categories = ["All", "HR", "IT", "Events", "General"];

  return (
    <DashboardLayout internalUser={internalUser} role={displayRole}>
      {/* Header Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Company Announcements</h1>
            <p className="text-sm text-gray-500 mt-0.5">Latest updates from HR & teams</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search updates..." 
                className="w-full pl-9 pr-3 h-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {displayRole !== "Employee" && (
              <div className="relative w-full sm:w-auto hidden sm:block">
                <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select 
                  className="w-full pl-9 pr-8 h-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white appearance-none cursor-pointer"
                  value={activeCategory}
                  onChange={(e) => setActiveCategory(e.target.value)}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}

            {isHR && (
              <button 
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white h-10 px-4 rounded-lg text-sm font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                onClick={() => { setEditingAnnouncement(null); setShowForm(true); }}
              >
                <Plus size={16} strokeWidth={2.5} /> 
                <span>Create Post</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Feed (70%) */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {/* Featured Announcement (Replaces Carousel) */}
            {!searchQuery && activeCategory === "All" && announcements.filter(a => a.is_pinned).length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Megaphone size={18} className="text-gray-400" />
                  <h2 className="text-lg font-semibold text-gray-900">Featured</h2>
                </div>
                {/* Render the top pinned announcement using the new clean card design */}
                <AnnouncementCard 
                  announcement={announcements.filter(a => a.is_pinned)[0]} 
                  onReact={handleReact} 
                  canEdit={isHR}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              </section>
            )}


            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {searchQuery ? "Search Results" : "Recent Updates"}
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
                  <Archive size={32} className="text-gray-300 mb-3" />
                  <h3 className="text-base font-semibold text-gray-900">No updates found</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {searchQuery ? `No results for "${searchQuery}".` : "There are currently no announcements."}
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

          {/* Right Column: Sidebar (30%) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Stats Panel */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold text-gray-900">{stats.total}</span>
                  <span className="text-xs text-gray-500 mt-0.5">Total Updates</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-semibold text-gray-900">{stats.thisWeek}</span>
                  <span className="text-xs text-gray-500 mt-0.5">This Week</span>
                </div>
              </div>
            </div>

            {/* Categories Panel */}
            {displayRole !== "Employee" && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Filters</h3>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => (
                    <button
                      key={c}
                      onClick={() => setActiveCategory(c)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                        activeCategory === c 
                          ? "bg-gray-900 text-white border-gray-900" 
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                {isHR && (
                  <div className="mt-6 pt-6 border-t border-gray-100 flex flex-col gap-2">
                    <button 
                      onClick={() => { setEditingAnnouncement(null); setShowForm(true); }}
                      className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors border border-red-100 flex items-center justify-center gap-2"
                    >
                      <Plus size={16} strokeWidth={2.5} /> Create Post
                    </button>
                    <button className="w-full py-2 px-3 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      <Archive size={16} strokeWidth={2.5} /> View Drafts
                    </button>
                  </div>
                )}
              </div>
            )}
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

