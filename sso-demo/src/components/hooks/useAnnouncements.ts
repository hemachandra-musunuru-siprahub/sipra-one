import { useState, useEffect, useCallback } from "react";
import { getAnnouncements, getArchivedAnnouncements } from "../../api/announcements";
import type { Announcement } from "../../api/types";

export function useAnnouncements(initialPage = 1, limit = 20, status = "published", enabled = true) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(true);

  const fetchAnnouncements = useCallback(async (p: number, overwrite = false) => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = status === "archived" 
        ? await getArchivedAnnouncements(p, limit, { skipGlobalRedirect: true })
        : await getAnnouncements(p, limit, status, { skipGlobalRedirect: true });
      console.log(`[useAnnouncements] Fetched announcements (${status}):`, data.announcements);
      setAnnouncements(prev => overwrite ? data.announcements : [...prev, ...data.announcements]);
      setHasMore(data.announcements.length === limit);
      setPage(p);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      console.error("Failed to fetch announcements:", err);
    } finally {
      setLoading(false);
    }
  }, [limit, status, enabled]);

  useEffect(() => {
    if (enabled) {
      fetchAnnouncements(initialPage, true);
    } else {
      setLoading(false);
    }
  }, [fetchAnnouncements, initialPage, enabled]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchAnnouncements(page + 1);
    }
  }, [loading, hasMore, page, fetchAnnouncements]);

  const refresh = useCallback(() => {
    fetchAnnouncements(1, true);
  }, [fetchAnnouncements]);

  return { announcements, loading, error, hasMore, loadMore, refresh, setAnnouncements };
}
