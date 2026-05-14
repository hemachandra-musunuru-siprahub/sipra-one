import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../../authConfig";
import { ShieldCheck } from "lucide-react";
import { AppLogo } from "../../components/common/AppLogo";

/* ── LoginPage ──────────────────────────────────────────────────────────────────
   Responsibilities:
   1. If the user is already authenticated → redirect straight to /dashboard
   2. If MSAL is processing a redirect callback (inProgress !== None) → show spinner
   3. If there's no account yet → call loginRedirect once (guard with ref)
   4. After redirect callback land here → MSAL picks up the code, sets account → redirect to /dashboard
─────────────────────────────────────────────────────────────────────────────── */

export const LoginPage: React.FC = () => {
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectStarted = useRef(false);
  const [status, setStatus] = useState<"idle" | "redirecting" | "processing">("idle");

  // Where to go after login — caller can pass `?next=/some/path`
  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/dashboard";

  useEffect(() => {
    // Already authenticated — skip to dashboard
    if (isAuthenticated && accounts.length > 0) {
      navigate(next, { replace: true });
      return;
    }

    // MSAL is processing its redirect callback — wait
    if (inProgress !== InteractionStatus.None) {
      setStatus("processing");
      return;
    }

    // MSAL settled + account appeared after redirect callback
    if (accounts.length > 0) {
      navigate(next, { replace: true });
      return;
    }

    // No account and MSAL idle → trigger redirect (only once)
    if (!redirectStarted.current) {
      redirectStarted.current = true;
      setStatus("redirecting");
      instance.loginRedirect({
        ...loginRequest,
        redirectStartPage: window.location.href,
      }).catch(err => {
        console.error("[LoginPage] loginRedirect failed:", err);
        redirectStarted.current = false;
        setStatus("idle");
      });
    }
  }, [isAuthenticated, inProgress, accounts, instance, navigate, next]);

  const label =
    status === "redirecting" ? "Redirecting to Microsoft…" :
    status === "processing" ? "Completing sign-in…" :
    "Connecting to Microsoft…";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#FAF7F7",
        fontFamily: "Inter, system-ui, sans-serif",
        gap: 0,
      }}
    >
      <style>{`
        @keyframes sipra-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Brand mark */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 40 }}>
        <AppLogo variant="landing" />
      </div>

      {/* Card */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E4DCDC",
          borderRadius: 12,
          padding: "40px 48px",
          textAlign: "center",
          maxWidth: 400,
          width: "calc(100% - 48px)",
          boxShadow: "0 2px 8px rgba(206,33,36,0.06)",
        }}
      >
        {/* Spinner */}
        <div
          style={{
            width: 44,
            height: 44,
            border: "3px solid #E4DCDC",
            borderTop: "3px solid #CE2124",
            borderRadius: "50%",
            animation: "sipra-spin 0.75s linear infinite",
            margin: "0 auto 20px",
          }}
        />

        <h1
          style={{ fontSize: "1.125rem", fontWeight: 700, color: "#282020", marginBottom: 8, letterSpacing: "-0.01em" }}
        >
          Signing you in
        </h1>
        <p style={{ fontSize: "0.875rem", color: "#574F4F", marginBottom: 24, lineHeight: 1.6 }}>
          {label}
        </p>

        {/* Microsoft branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "10px 16px",
            borderRadius: 8,
            background: "#FAF7F7",
            border: "1px solid #E4DCDC",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 21 21" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          <span style={{ fontSize: "0.8125rem", color: "#574F4F", fontWeight: 500 }}>
            Microsoft Entra ID
          </span>
        </div>
      </div>

      <p style={{ marginTop: 24, fontSize: "0.75rem", color: "#9E9494" }}>
        Protected by zero-trust authentication
      </p>
    </div>
  );
};
