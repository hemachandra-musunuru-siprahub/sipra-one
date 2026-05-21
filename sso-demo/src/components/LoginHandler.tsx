import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useEffect, useRef, useState } from "react";
import { loginRequest } from "../authConfig";
import { InteractionStatus } from "@azure/msal-browser";
import { AppLogo } from "./common/AppLogo";

const API = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");

// ─── Session cache key ────────────────────────────────────────────────────────
export const SESSION_CACHE_KEY = "sipra_session";

export const clearSessionCache = () => localStorage.removeItem(SESSION_CACHE_KEY);

const readCache = (): any | null => {
  try {
    const raw = localStorage.getItem(SESSION_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCache = (user: any) => {
  try {
    localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(user));
  } catch {
    // localStorage quota exceeded — non-fatal
  }
};

// ─── Timeout helper ───────────────────────────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

interface SyncResult {
  user: any;
}

// Module-level promise — prevent concurrent duplicate syncs across re-renders
let _syncPromise: Promise<SyncResult | null> | null = null;

export const LoginHandler = ({
  children,
  onSyncComplete,
}: {
  children: React.ReactNode;
  onSyncComplete?: (user: any) => void;
}) => {
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  // Check the localStorage cache synchronously on first render
  const cachedUser = readCache();

  const [isInitializing, setIsInitializing] = useState(!cachedUser);
  const [isSyncing,      setIsSyncing]      = useState(false);
  const [syncComplete,   setSyncComplete]   = useState(!!cachedUser);
  const hasSynced = useRef(!!cachedUser);

  // ── Optimistically surface the cached user immediately ──────────────────────
  useEffect(() => {
    if (cachedUser) {
      onSyncComplete?.(cachedUser);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncWithBackend = async (isBackground = false): Promise<SyncResult | null> => {
    if (accounts.length === 0) return null;
    if (_syncPromise) return _syncPromise;

    _syncPromise = (async () => {
      try {
        const tokenResponse = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });

        const syncFetch = fetch(`${API}/api/auth/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            accessToken: tokenResponse.accessToken,
            idToken:     tokenResponse.idToken,
          }),
        });

        // Apply 3-second timeout on full sync when in background verification
        const res = isBackground
          ? await withTimeout(syncFetch, 3000)
          : await syncFetch;

        if (!res.ok) {
          console.error("[LoginHandler] Backend sync failed:", res.status);
          if (isBackground) {
            // Don't force re-login — just clear stale cache so next page load re-syncs fresh
            clearSessionCache();
            console.warn("[LoginHandler] Background sync failed — stale session cleared. Will re-authenticate.");
          }
          return null;
        }

        const data = await res.json();
        writeCache(data.user);
        onSyncComplete?.(data.user);
        return data as SyncResult;

      } catch (e: any) {
        console.error("[LoginHandler] Sync error:", e.message);
        if (isBackground) {
          // Timeout or network failure — clear cache but don't force re-login aggressively
          clearSessionCache();
          console.warn("[LoginHandler] Background sync timed out — stale session cleared.");
        }
        return null;
      } finally {
        _syncPromise = null;
      }
    })();

    return _syncPromise;
  };

  useEffect(() => {
    const checkLogin = async () => {
      if (inProgress !== InteractionStatus.None) return;

      if (accounts.length > 0) {
        // ── Strip OAuth code from URL immediately to prevent re-triggers ───────
        if (window.location.hash.includes("code=") || window.location.search.includes("code=")) {
          history.replaceState({}, "", window.location.pathname);
        }

        if (!hasSynced.current) {
          hasSynced.current = true;

          if (cachedUser) {
            // Returning user — already surfaced from cache; re-verify silently in bg
            // If bg sync fails (stale cookie), cache is cleared so next refresh does full sync
            syncWithBackend(true).then(result => {
              if (!result) {
                // Background sync failed — session cookie is gone. Do a foreground sync now.
                console.warn("[LoginHandler] Session stale, performing foreground re-sync...");
                setIsSyncing(true);
                syncWithBackend(false).finally(() => {
                  setIsSyncing(false);
                  setIsInitializing(false);
                  setSyncComplete(true);
                });
              } else {
                setIsInitializing(false);
                setSyncComplete(true);
              }
            });
          } else {
            // Fresh login — show spinner, do full sync
            setIsSyncing(true);
            await syncWithBackend(false);
            setIsSyncing(false);
            setSyncComplete(true);
            setIsInitializing(false);
          }
        } else {
          setIsInitializing(false);
        }
        return;
      }

      // No MSAL account here — ProtectedRoute already redirected to /login.
      // LoginHandler should not trigger auth flows; just clear initializing state.
      setIsInitializing(false);
    };

    checkLogin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance, inProgress, accounts, isAuthenticated, syncComplete]);

  // ── Spinner: only shown for new (uncached) users ──────────────────────────
  const showSpinner = !cachedUser && (isInitializing || isSyncing || (accounts.length > 0 && !syncComplete));

  if (showSpinner) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontFamily: "'Inter', system-ui, sans-serif",
          backgroundColor: "var(--neutral-50, #FAF7F7)",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            border: "3px solid var(--neutral-200, #E4DCDC)",
            borderTop: "3px solid var(--primary-500, #CE2124)",
            borderRadius: "50%",
            animation: "sipra-spin 0.7s linear infinite",
          }}
        />
        <style>{`
          @keyframes sipra-spin {
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
            <AppLogo variant="landing" />
          </div>
          <div style={{ fontSize: "0.875rem", color: "var(--neutral-500, #736A6A)" }}>
            {isSyncing ? "Signing you in…" : "Verifying session…"}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
