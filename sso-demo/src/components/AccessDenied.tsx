import React from "react";
import { ShieldAlert, ArrowLeft, LogOut } from "lucide-react";
import { useMsal } from "@azure/msal-react";
import { useNavigate } from "react-router-dom";

export const AccessDenied = () => {
  const { instance } = useMsal();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("sipra_session");
    sessionStorage.clear();
    const API = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
    // Fire backend logout in parallel — don't block on it
    fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(console.error);
    instance.logoutRedirect({ postLogoutRedirectUri: "/" }).catch(console.error);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--neutral-50)', padding: 'var(--space-8)' }}>
      <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: 'var(--space-12)' }}>
        <div style={{ width: 80, height: 80, borderRadius: 'var(--rounded-full)', background: 'var(--primary-50)', color: 'var(--primary-500)', display: 'grid', placeItems: 'center', margin: '0 auto var(--space-6)' }}>
          <ShieldAlert size={40} />
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--neutral-900)', marginBottom: 'var(--space-2)' }}>
          Access Denied
        </h1>
        <p style={{ color: 'var(--neutral-500)', marginBottom: 'var(--space-8)', lineHeight: 1.6 }}>
          You do not have the required Microsoft Entra ID role to access this section of the intranet. 
          Please contact IT Support if you believe this is a mistake.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <button className="btn btn--primary" onClick={() => navigate("/")}>
            <ArrowLeft size={16} />
            Back to Home
          </button>
          <button className="btn btn--secondary" onClick={handleLogout}>
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
