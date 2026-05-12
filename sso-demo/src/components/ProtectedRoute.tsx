import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useIsAuthenticated } from "@azure/msal-react";
import { LoginHandler } from "./LoginHandler";

/* ── ProtectedRoute ─────────────────────────────────────────────────────────────
   Gate any route behind authentication.

   Flow:
   - Not authenticated → redirect to /login?next=<current path>
   - Authenticated → wrap in LoginHandler (handles backend sync + session)
   - During MSAL interaction (e.g. processing the redirect callback) → LoginPage
     already handles the spinner, so ProtectedRoute only needs to guard once
     the interaction is complete.
─────────────────────────────────────────────────────────────────────────────── */

interface ProtectedRouteProps {
  children: React.ReactNode;
  onSyncComplete?: (user: any) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const ProtectedRoute = ({ children, onSyncComplete }: ProtectedRouteProps) => {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();

  if (!isAuthenticated) {
    // Preserve the attempted path so LoginPage can redirect back after auth
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return (
    <LoginHandler onSyncComplete={onSyncComplete}>
      {children}
    </LoginHandler>
  );
};
