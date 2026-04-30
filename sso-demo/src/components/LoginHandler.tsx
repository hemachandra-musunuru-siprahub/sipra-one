import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useEffect, useRef, useState } from "react";
import { loginRequest } from "../authConfig";
import { InteractionStatus, InteractionRequiredAuthError } from "@azure/msal-browser";

const API = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

interface SyncResult {
  user: any;
}

// Module-level promise so concurrent renders don't fire duplicate syncs
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
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const hasSynced = useRef(false);

  const syncWithBackend = async (): Promise<SyncResult | null> => {
    if (accounts.length === 0) return null;

    // Reuse in-flight sync if already running
    if (_syncPromise) return _syncPromise;

    _syncPromise = (async () => {
      try {
        // Acquire token silently — MSAL caches this, near-zero latency on repeat
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });

        const res = await fetch(`${API}/api/auth/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            accessToken: response.accessToken,
            idToken: response.idToken,
          }),
        });

        if (!res.ok) {
          console.error("[LoginHandler] Backend sync failed:", res.status);
          return null;
        }

        const data = await res.json();
        // Pass user data directly to parent — no need for a second /me call
        onSyncComplete?.(data.user);
        return data as SyncResult;
      } catch (e) {
        console.error("[LoginHandler] Error during backend sync:", e);
        return null;
      } finally {
        // Clear so next login attempt re-syncs
        _syncPromise = null;
      }
    })();

    return _syncPromise;
  };

  useEffect(() => {
    const checkLogin = async () => {
      // Wait for MSAL interaction to finish
      if (inProgress !== InteractionStatus.None) return;

      if (accounts.length > 0) {
        if (!hasSynced.current) {
          hasSynced.current = true;
          setIsSyncing(true);
          await syncWithBackend();
          setIsSyncing(false);
          setSyncComplete(true);
        }
        setIsInitializing(false);
        return;
      }

      try {
        await instance.ssoSilent(loginRequest);
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          await instance.loginRedirect(loginRequest);
        } else {
          await instance.loginRedirect(loginRequest);
        }
      } finally {
        setIsInitializing(false);
      }
    };

    checkLogin();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instance, inProgress, accounts, isAuthenticated, syncComplete]);

  const syncWithBackend = async () => {
    if (accounts.length === 0) return;
    setIsSyncing(true);
    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      
      const res = await fetch("http://localhost:3000/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          accessToken: response.accessToken, 
          idToken: response.idToken 
        }),
      });
      
      if (!res.ok) {
        console.error("Backend sync failed");
      } else {
        console.log("Backend sync successful");
        await fetch("http://localhost:3000/api/auth/me", { credentials: "include" });
      }
    } catch (e) {
      console.error("Error acquiring token for backend sync", e);
    } finally {
      setSyncComplete(true);
      setIsSyncing(false);
    }
  };

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
        {/* SipraHub branded spinner */}
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
          <div
            style={{
              fontWeight: 700,
              fontSize: "1.125rem",
              color: "var(--neutral-800, #282020)",
              letterSpacing: "-0.01em",
              marginBottom: 4,
            }}
          >
            SipraHub
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
