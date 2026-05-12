import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

/* ── Inline globe animation (no external dep) ─────────────────────── */
const GlobeStyles = () => (
  <style>{`
    @keyframes earthRotate { 0% { background-position: 0 0; } 100% { background-position: 400px 0; } }
    @keyframes tw { 0%,100% { opacity:.1; } 50% { opacity:1; } }
    @keyframes land-fade-in { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    .land-fade { animation: land-fade-in .6s ease-out both; }
    .land-fade-1 { animation-delay:.1s; }
    .land-fade-2 { animation-delay:.25s; }
    .land-fade-3 { animation-delay:.4s; }
    .land-fade-4 { animation-delay:.55s; }
    .land-fade-5 { animation-delay:.7s; }
  `}</style>
);

function AnimatedGlobe() {
  return (
    <div
      className="relative w-[260px] h-[260px] rounded-full overflow-hidden flex-shrink-0"
      style={{
        backgroundImage: "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/globe.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "left",
        animation: "earthRotate 30s linear infinite",
        boxShadow:
          "0 0 20px rgba(255,255,255,0.2),-5px 0 8px #c3f4ff inset,15px 2px 25px #000 inset,-24px -2px 34px #c3f4ff99 inset,250px 0 44px #00000066 inset,150px 0 38px #000000aa inset",
      }}
    >
      {[
        { left: "-20px", top: "50%", delay: "0s" },
        { left: "-40px", top: "30px", delay: ".8s" },
        { left: "200px", top: "-10px", delay: "1.2s" },
        { left: "240px", top: "200px", delay: ".4s" },
        { left: "50px", top: "220px", delay: "2s" },
      ].map((s, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-white rounded-full"
          style={{ left: s.left, top: s.top, animation: `tw ${2 + i * 0.5}s infinite` }}
        />
      ))}
    </div>
  );
}

/* ── Feature pill ─────────────────────────────────────────────────── */
function Pill({ text }: { text: string }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
      style={{ background: "#FFF0F0", color: "#CE2124", border: "1px solid #FFADB0" }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#CE2124]" />
      {text}
    </div>
  );
}

/* ── Stat card ────────────────────────────────────────────────────── */
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 px-5 py-3 rounded-lg"
      style={{ background: "#FFFFFF", border: "1px solid #E4DCDC" }}
    >
      <span className="text-xl font-bold" style={{ color: "#282020" }}>{value}</span>
      <span className="text-xs" style={{ color: "#9E9494" }}>{label}</span>
    </div>
  );
}

/* ── Feature row ──────────────────────────────────────────────────── */
function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div
        className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
        style={{ background: "#FFF0F0", color: "#CE2124" }}
      >
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold mb-0.5" style={{ color: "#282020" }}>{title}</div>
        <div className="text-sm leading-relaxed" style={{ color: "#574F4F" }}>{desc}</div>
      </div>
    </div>
  );
}

/* ── Microsoft SSO button ─────────────────────────────────────────── */
function SignInButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 h-10 px-5 rounded-md text-sm font-semibold text-white transition-all duration-150 ease-out hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ background: "#CE2124" } as React.CSSProperties}
      onFocus={e => (e.currentTarget.style.boxShadow = "0 0 0 2px #FAF7F7, 0 0 0 4px #FFADB0")}
      onBlur={e => (e.currentTarget.style.boxShadow = "none")}
    >
      {/* Microsoft logo */}
      <svg width="16" height="16" viewBox="0 0 21 21" fill="none" aria-hidden="true">
        <rect x="1" y="1" width="9" height="9" fill="#f25022" />
        <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
        <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
      </svg>
      Sign in with Microsoft
    </button>
  );
}

/* ── Main LandingPage ─────────────────────────────────────────────── */
export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const goToLogin = () => navigate("/login");

  return (
    <div className="min-h-screen font-[Inter,system-ui,sans-serif]" style={{ background: "#FAF7F7" }}>
      <GlobeStyles />

      {/* ── Topbar ──────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between h-14 px-6"
        style={{ background: "#FFFFFF", borderBottom: "1px solid #E4DCDC" }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} strokeWidth={1.5} style={{ color: "#CE2124" }} />
          <span className="text-[17px] font-medium" style={{ color: "#282020" }}>SipraHub</span>
        </div>
        <button
          onClick={goToLogin}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-semibold text-white transition-all duration-150 ease-out hover:opacity-90 focus:outline-none"
          style={{ background: "#CE2124" }}
          onFocus={e => (e.currentTarget.style.boxShadow = "0 0 0 2px #FAF7F7, 0 0 0 4px #FFADB0")}
          onBlur={e => (e.currentTarget.style.boxShadow = "none")}
        >
          <svg width="14" height="14" viewBox="0 0 21 21" fill="none" aria-hidden="true">
            <rect x="1" y="1" width="9" height="9" fill="#f25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
            <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          Sign in
        </button>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="pt-14 min-h-screen flex items-center">
        <div className="max-w-6xl mx-auto px-6 py-20 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left: copy */}
          <div className="flex flex-col gap-6">
            <div className="land-fade land-fade-1">
              <Pill text="SipraHub" />
            </div>
            <div className="land-fade land-fade-2">
              <h1 className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight" style={{ color: "#282020" }}>
                The intelligent<br />
                <span style={{ color: "#CE2124" }}>enterprise workspace</span>
              </h1>
            </div>
            <div className="land-fade land-fade-3">
              <p className="text-lg leading-relaxed max-w-md" style={{ color: "#574F4F" }}>
                Unify your company's knowledge, HR operations, and team collaboration
                into one secure, zero-trust platform. Built for modern enterprise teams.
              </p>
            </div>
            <div className="land-fade land-fade-4 flex flex-wrap gap-3">
              <SignInButton onClick={goToLogin} />
              <a
                href="#features"
                className="inline-flex items-center h-10 px-5 rounded-md text-sm font-semibold transition-all duration-150 ease-out hover:opacity-80 focus:outline-none"
                style={{ border: "1px solid #E4DCDC", color: "#574F4F" }}
              >
                Learn more
              </a>
            </div>

            {/* Stats */}
            <div className="land-fade land-fade-5 flex flex-wrap gap-3 pt-2">
              <StatCard value="99.99%" label="Uptime" />
              <StatCard value="14.2ms" label="Avg latency" />
              <StatCard value="2,491" label="Active sessions" />
            </div>
          </div>

          {/* Right: globe */}
          <div className="hidden lg:flex justify-center items-center land-fade land-fade-3">
            <AnimatedGlobe />
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Pill text="Platform" />
            <h2 className="mt-4 text-4xl font-bold tracking-tight" style={{ color: "#282020" }}>
              Everything your team needs
            </h2>
            <p className="mt-3 text-lg max-w-xl mx-auto" style={{ color: "#574F4F" }}>
              From HR operations to company news — all under one roof with a consistent, branded experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
                title: "Zero-trust security",
                desc: "Microsoft Entra ID SSO with server-authoritative sessions. Every request is verified.",
              },
              {
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
                title: "Employee directory",
                desc: "Search, filter, and connect with colleagues across every department instantly.",
              },
              {
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>,
                title: "Document library",
                desc: "Policies, handbooks, and compliance docs — versioned and fully searchable.",
              },
              {
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>,
                title: "News & announcements",
                desc: "Department-specific news, pinned announcements, and urgent alerts in real time.",
              },
              {
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
                title: "Leave management",
                desc: "Apply, approve, and track leave requests with a full audit trail per role.",
              },
              {
                icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
                title: "Timesheet tracking",
                desc: "Weekly timesheets with manager review workflows and HR-level visibility.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="p-6 rounded-lg transition-shadow duration-150 ease-out hover:shadow-[0_2px_8px_rgba(206,33,36,0.08)]"
                style={{ background: "#FFFFFF", border: "1px solid #E4DCDC" }}
              >
                <FeatureItem icon={f.icon} title={f.title} desc={f.desc} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Security section ─────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ background: "#FFFFFF", borderTop: "1px solid #E4DCDC", borderBottom: "1px solid #E4DCDC" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <Pill text="Zero-trust security" />
            <h2 className="mt-4 text-4xl font-bold tracking-tight" style={{ color: "#282020" }}>
              Security you can trust
            </h2>
            <p className="mt-3 text-lg leading-relaxed" style={{ color: "#574F4F" }}>
              Built on Microsoft Entra ID SSO with zero-trust architecture. Every access request
              is verified, every session is protected, and every user is authenticated against
              your corporate directory.
            </p>
            <div className="mt-8 flex flex-col gap-5">
              {[
                { icon: "🔑", title: "Entra ID SSO", desc: "Single sign-on via Microsoft corporate credentials — no separate passwords." },
                { icon: "🛡️", title: "Zero-trust gateway", desc: "Every request is verified. No implicit trust, no open sessions." },
                { icon: "⚡", title: "Real-time sync", desc: "User roles, permissions, and directory changes sync instantly." },
              ].map((f, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-xl flex-shrink-0 mt-0.5">{f.icon}</span>
                  <div>
                    <div className="text-sm font-semibold mb-0.5" style={{ color: "#282020" }}>{f.title}</div>
                    <div className="text-sm" style={{ color: "#574F4F" }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:flex justify-center hidden">
            <div
              className="w-[260px] h-[260px] rounded-2xl flex flex-col items-center justify-center gap-4 p-8"
              style={{ background: "#FFF0F0", border: "1px solid #FFADB0" }}
            >
              <ShieldCheck size={64} strokeWidth={1} style={{ color: "#CE2124" }} />
              <div className="text-center">
                <div className="text-sm font-bold mb-1" style={{ color: "#282020" }}>Zero-Trust Enforced</div>
                <div className="text-xs leading-relaxed" style={{ color: "#574F4F" }}>
                  Every session verified against Microsoft Entra ID in real time.
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: "#10B981", animation: "tw 2s infinite" }} />
                <span className="text-xs font-semibold" style={{ color: "#10B981" }}>All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ── CTA ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <Pill text="Get started" />
          <h2 className="mt-4 text-4xl font-bold tracking-tight" style={{ color: "#282020" }}>
            Your workspace<br />
            <span style={{ color: "#CE2124" }}>starts here</span>
          </h2>
          <p className="mt-3 text-lg" style={{ color: "#574F4F" }}>
            Join 2,491 active sessions already running on SipraHub.
            Enterprise-grade security — ready for your team today.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <SignInButton onClick={goToLogin} />
            <a
              href="mailto:it-support@sipra.com"
              className="inline-flex items-center h-10 px-5 rounded-md text-sm font-semibold transition-all duration-150 ease-out hover:opacity-80"
              style={{ border: "1px solid #E4DCDC", color: "#574F4F" }}
            >
              Contact IT support
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="px-6 py-8 text-center text-xs" style={{ borderTop: "1px solid #E4DCDC", color: "#9E9494" }}>
        © {new Date().getFullYear()} Sipra Industries. All rights reserved.
      </footer>
    </div>
  );
};
