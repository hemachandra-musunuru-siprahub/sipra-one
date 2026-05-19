import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "../../authConfig";
import { AppLogo } from "../../components/common/AppLogo";

/* ── LoginPage ──────────────────────────────────────────────────────────────────
   Responsibilities:
   1. If the user is already authenticated → redirect straight to /dashboard
   2. If MSAL is processing a redirect callback (inProgress !== None) → show spinner
   3. If there's no account yet → call loginRedirect once (guard with ref)
   4. After redirect callback land here → MSAL picks up the code, sets account → redirect
─────────────────────────────────────────────────────────────────────────────── */

export const LoginPage: React.FC = () => {
  const { instance, inProgress, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectStarted = useRef(false);
  const [status, setStatus] = useState<"idle" | "redirecting" | "processing">("idle");

  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "/dashboard";

  useEffect(() => {
    // Dev sync bypass (used by backend dev-login redirect only)
    if (import.meta.env.DEV && params.get("sync_dev") === "true") {
      const user = {
        id: Number(params.get("id")),
        entra_oid: params.get("entra_oid") || "",
        email: params.get("email") || "",
        name: params.get("name") || "",
        role: params.get("role") || "Employee",
        is_active: true,
      };
      localStorage.setItem("sipra_session", JSON.stringify(user));
      navigate("/dashboard", { replace: true });
      return;
    }

    // Dev bypass if already logged in locally
    if (import.meta.env.DEV && localStorage.getItem("sipra_session")) {
      navigate(next, { replace: true });
      return;
    }

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
      instance
        .loginRedirect({
          ...loginRequest,
          redirectStartPage: window.location.href,
        })
        .catch((err) => {
          console.error("[LoginPage] loginRedirect failed:", err);
          redirectStarted.current = false;
          setStatus("idle");
        });
    }
  }, [isAuthenticated, inProgress, accounts, instance, navigate, next, location.search]);

  const handleMicrosoftLogin = () => {
    setStatus("redirecting");
    instance
      .loginRedirect({
        ...loginRequest,
        redirectStartPage: window.location.href,
      })
      .catch((err) => {
        console.error("[LoginPage] Manual loginRedirect failed:", err);
        setStatus("idle");
      });
  };

  const label =
    status === "redirecting"
      ? "Redirecting to Microsoft…"
      : status === "processing"
      ? "Completing sign-in…"
      : "Connecting to Microsoft…";

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
        padding: "20px",
      }}
    >
      <style>{`
        @keyframes sipra-spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Brand mark */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
        <AppLogo variant="landing" />
      </div>

      {/* Card */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E4DCDC",
          borderRadius: 12,
          padding: "36px 40px",
          textAlign: "center",
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 4px 20px rgba(206,33,36,0.04)",
        }}
      >
        {status === "idle" ? (
          /* Idle — show sign-in button */
          <div>
            <h1
              style={{
                fontSize: "1.25rem",
                fontWeight: 700,
                color: "#282020",
                marginBottom: 8,
                letterSpacing: "-0.01em",
              }}
            >
              Welcome to SipraHub
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#736A6A",
                marginBottom: 28,
                lineHeight: 1.6,
              }}
            >
              Sign in with your corporate Microsoft account to continue.
            </p>

            <button
              onClick={handleMicrosoftLogin}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                width: "100%",
                padding: "13px 16px",
                borderRadius: 8,
                background: "#FAF7F7",
                border: "1px solid #E4DCDC",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "#282020",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#FFF";
                e.currentTarget.style.borderColor = "#CE2124";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(206,33,36,0.08)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#FAF7F7";
                e.currentTarget.style.borderColor = "#E4DCDC";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 21 21" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Sign in with Microsoft
            </button>
          </div>
        ) : (
          /* Redirecting / Processing — show spinner */
          <div>
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
              style={{
                fontSize: "1.125rem",
                fontWeight: 700,
                color: "#282020",
                marginBottom: 8,
                letterSpacing: "-0.01em",
              }}
            >
              Signing you in
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#574F4F", marginBottom: 24, lineHeight: 1.6 }}>
              {label}
            </p>

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
        )}
      </div>

      <p style={{ marginTop: 24, fontSize: "0.75rem", color: "#9E9494" }}>
        Protected by zero-trust authentication
      </p>
    </div>
  );
};
