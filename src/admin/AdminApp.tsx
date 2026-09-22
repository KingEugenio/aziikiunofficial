import React, { Suspense, lazy, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  SquaresFour as LayoutDashboard,
  ToggleLeft,
  Megaphone,
  ClipboardText,
  Image as ImageIcon,
  CreditCard,
  BookOpen,
  UsersThree,
  Notebook,
  SignOut as LogOut,
  ShieldWarning,
  List as MenuIcon,
  X as CloseIcon,
  ChatText as MessageSquare,
  Users,
  Pulse as ActivityIcon,
} from "@phosphor-icons/react";
import { supabase } from "../lib/supabaseClient";
import { api } from "../lib/api";
import BrandLogo from "../components/BrandLogo";
import AdminDashboardHome from "./AdminDashboardHome";
import ActivityMonitoringPanel from "./ActivityMonitoringPanel";
import FeatureFlagsPanel from "./FeatureFlagsPanel";
import AnnouncementsPanel from "./AnnouncementsPanel";
import SurveysPanel from "./SurveysPanel";
import BrandingPanel from "./BrandingPanel";
import PaymentsPanel from "./PaymentsPanel";
import GuidesPanel from "./GuidesPanel";
import AdminsPanel from "./AdminsPanel";
import SiteContentPanel from "./SiteContentPanel";
import FeedbackPanel from "./FeedbackPanel";
import UsersPanel from "./UsersPanel";

const AuthPortal = lazy(() => import("../components/AuthPortal"));

type AdminStatus = "checking" | "authorized" | "unauthorized";
type Tab = "dashboard" | "flags" | "announcements" | "surveys" | "branding" | "payments" | "content" | "guides" | "admins" | "feedback" | "users" | "activity";

const NAV: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "flags", label: "Feature Flags", icon: ToggleLeft },
  { id: "users", label: "Users", icon: Users },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "surveys", label: "Surveys", icon: ClipboardText },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "branding", label: "Branding Kits", icon: ImageIcon },
  { id: "content", label: "Site Content", icon: Notebook },
  { id: "guides", label: "Guides", icon: BookOpen },
  { id: "admins", label: "Admins", icon: UsersThree },
  { id: "activity", label: "Activity Monitoring", icon: ActivityIcon },
];

/**
 * Separate root component, mounted instead of <App/> when the URL path is
 * /admin (see main.tsx). Deliberately its own auth check rather than
 * reusing App.tsx's session state - an admin visiting /admin has almost
 * certainly never opened the main app in this browser, and this keeps the
 * portal's code (and its extra checks) out of the bundle everyone else
 * downloads.
 */
export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [adminStatus, setAdminStatus] = useState<AdminStatus>("checking");
  const [activeTab, setActiveTab] = useState<Tab | null>(null);
  const [sections, setSections] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoaded(true);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setSessionLoaded(true);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  // Deliberately keyed on the access token string (a stable primitive), not
  // the `session` object itself: supabase-js hands onAuthStateChange a
  // brand-new Session object on effectively every event, including ones
  // that don't change who's signed in (tab focus, token auto-refresh
  // ticks, ...). Depending on the object caused this effect to refire
  // continuously - each refire called api.admin.me(), which itself calls
  // getSession() (see src/lib/api.ts), producing another auth event and
  // never letting "authorized" stay painted long enough to render.
  const accessToken = session?.access_token;

  useEffect(() => {
    if (!sessionLoaded) return; // still loading the initial session
    if (!accessToken) {
      setAdminStatus("unauthorized");
      return;
    }
    setAdminStatus("checking");
    api.admin
      .me()
      .then(({ data }) => {
        const mySections = data.isSuperAdmin ? NAV.map((n) => n.id) : data.sections;
        setSections(mySections);
        setActiveTab((mySections[0] as Tab) ?? null);
        setAdminStatus("authorized");
      })
      .catch(() => setAdminStatus("unauthorized"));
  }, [sessionLoaded, accessToken]);

  const visibleNav = NAV.filter((item) => sections.includes(item.id));

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (session === undefined) {
    return <CenteredMessage>Loading...</CenteredMessage>;
  }

  if (!session) {
    return (
      <Suspense fallback={<CenteredMessage>Loading...</CenteredMessage>}>
        <AuthPortal
          onAuthSuccess={() => {
            /* onAuthStateChange above picks up the new session automatically. */
          }}
          onEnterGuest={() => {
            /* No-op: guest mode has no meaning in the admin portal. */
          }}
          hideGuestOption
        />
      </Suspense>
    );
  }

  if (adminStatus === "checking") {
    return <CenteredMessage>Checking admin access...</CenteredMessage>;
  }

  if (adminStatus === "unauthorized") {
    return (
      <CenteredMessage>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
            <ShieldWarning className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Not authorized</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              This account ({session.user.email}) doesn't have admin access to Aziiki.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </CenteredMessage>
    );
  }

  if (!activeTab) {
    return (
      <CenteredMessage>
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl max-w-sm w-full text-center space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900">No sections granted yet</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              This account ({session.user.email}) has admin access but no sections have been granted yet. Ask a superadmin
              to grant some from Admins.
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </CenteredMessage>
    );
  }

  const activeNav = visibleNav.find((n) => n.id === activeTab)!;

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-60 shrink-0 bg-white border-r border-slate-200 flex-col">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-100">
          <BrandLogo className="w-8 h-8" />
          <div>
            <p className="text-sm font-black text-slate-900 leading-tight">Aziiki</p>
            <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400">Admin</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const NavIcon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  active ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <NavIcon className="w-4 h-4 shrink-0" /> {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-slate-100 space-y-2">
          <p className="text-[9px] font-mono text-slate-400 px-3 truncate">{session.user.email}</p>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between md:justify-start gap-3">
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex items-center gap-2 md:hidden cursor-pointer"
            aria-expanded={mobileMenuOpen}
            aria-label="Admin sections menu"
          >
            <BrandLogo className="w-6 h-6" />
            <span className="text-xs font-black text-slate-900">{activeNav.label}</span>
            {mobileMenuOpen ? <CloseIcon className="w-4 h-4 text-slate-400" /> : <MenuIcon className="w-4 h-4 text-slate-400" />}
          </button>
          <h1 className="hidden md:block text-sm font-black text-slate-900">{activeNav.label}</h1>
          <button onClick={handleSignOut} className="md:hidden text-slate-400 cursor-pointer">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* Mobile nav (no sidebar below md) - a slide-down menu rather than a
            horizontal scroller, so every section (Dashboard, Feature Flags,
            Announcements, Surveys, Payments, Branding Kits, Site Content,
            Guides, Admins) is reachable in one tap without swiping to find it. */}
        {mobileMenuOpen && (
          <nav className="md:hidden flex flex-col bg-white border-b border-slate-200 shadow-sm animate-fade-in">
            {visibleNav.map((item) => {
              const NavIcon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2.5 px-4 py-3 text-xs font-bold cursor-pointer border-b border-slate-100 last:border-b-0 ${
                    active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <NavIcon className="w-4 h-4 shrink-0" /> {item.label}
                </button>
              );
            })}
          </nav>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-4xl w-full">
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
            {activeTab === "dashboard" && <AdminDashboardHome />}
            {activeTab === "flags" && <FeatureFlagsPanel />}
            {activeTab === "users" && <UsersPanel />}
            {activeTab === "announcements" && <AnnouncementsPanel />}
            {activeTab === "feedback" && <FeedbackPanel />}
            {activeTab === "surveys" && <SurveysPanel />}
            {activeTab === "payments" && <PaymentsPanel />}
            {activeTab === "branding" && <BrandingPanel />}
            {activeTab === "content" && <SiteContentPanel />}
            {activeTab === "guides" && <GuidesPanel />}
            {activeTab === "admins" && <AdminsPanel />}
            {activeTab === "activity" && <ActivityMonitoringPanel />}
          </div>
        </main>
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-xs text-slate-500">{children}</div>;
}
