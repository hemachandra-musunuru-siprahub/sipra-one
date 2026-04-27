import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { useEffect, useState } from "react";
import { loginRequest } from "../authConfig";
import { InteractionStatus, InteractionRequiredAuthError } from "@azure/msal-browser";

export const LoginHandler = ({ children }: { children: React.ReactNode }) => {
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);

  useEffect(() => {
    const checkLogin = async () => {
      // Wait for MSAL to finish all initializations and redirects
      if (inProgress !== InteractionStatus.None) {
        return;
      }

      // 1. Check if user is already authenticated
      if (accounts.length > 0) {
        if (!syncComplete && !isSyncing) {
          syncWithBackend();
        }
        setIsInitializing(false);
        return;
      }

      try {
        // 2. Try silent SSO login first
        console.log("Attempting silent SSO...");
        await instance.ssoSilent(loginRequest);
        console.log("Silent SSO successful");
      } catch (error) {
        console.warn("Silent SSO failed, redirecting to login...");
        if (error instanceof InteractionRequiredAuthError) {
          // 3. Fallback to interactive login if silent SSO fails
          await instance.loginRedirect(loginRequest);
        } else {
          // If it's another error, we still probably need to log in
          await instance.loginRedirect(loginRequest);
        }
      } finally {
        setIsInitializing(false);
      }
    };

    checkLogin();
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

  // Handle errors if needed but mostly we just want a "loading" state
  if (inProgress !== InteractionStatus.None || (accounts.length === 0 && isInitializing) || isSyncing || (!syncComplete && accounts.length > 0)) {
    return (
      <div style={{
        display: "flex", 
        flexDirection: "column",
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh", 
        fontFamily: "sans-serif",
        backgroundColor: "#f9fafb"
      }}>
        <div style={{
          width: "48px",
          height: "48px",
          border: "4px solid #e5e7eb",
          borderTop: "4px solid #2563eb",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ marginTop: "16px", color: "#4b5563" }}>
          {isSyncing ? "Syncing with SipraHub..." : "Signing you in silently..."}
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
