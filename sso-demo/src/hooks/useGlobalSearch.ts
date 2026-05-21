import { useState, useEffect, useRef } from 'react';

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: 'employee' | 'announcement' | 'hr_document';
  url: string | null;
}

export interface SearchResults {
  employees: SearchResult[];
  announcements: SearchResult[];
  hr_documents: SearchResult[];
}

export const useGlobalSearch = (query: string) => {
  const [results, setResults] = useState<SearchResults>({
    employees: [],
    announcements: [],
    hr_documents: []
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Clear results if query is too short
    if (query.trim().length < 2) {
      setResults({ employees: [], announcements: [], hr_documents: [] });
      setIsLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const API = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
        const response = await fetch(`${API}/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', 
        });

        if (!response.ok) {
          throw new Error('Search request failed');
        }

        const data = await response.json();
        setResults(data);
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // Ignore abort errors
          return;
        }
        setError(err.message);
        console.error('[SEARCH_HOOK] Error:', err);
      } finally {
        if (abortControllerRef.current === controller) {
          setIsLoading(false);
        }
      }
    };

    // 300ms Debounce
    const timer = setTimeout(fetchData, 300);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query]);

  return { results, isLoading, error };
};
