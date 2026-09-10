import React, { Suspense, lazy, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ToggleLeft, Megaphone, ClipboardText, SignOut as LogOut, ShieldWarning } from "@phosphor-icons/react";
import { supabase } from "../lib/supabaseClient";
import { api } from "../lib/api";
import Logo from "../components/Logo";
import FeatureFlagsPanel from "./FeatureFlagsPanel";
import AnnouncementsPanel from "./AnnouncementsPanel";
import SurveysPanel from "./SurveysPanel";

const AuthPortal = lazy(() => import("../components/AuthPortal"));

type AdminStatus = "checking" | "authorized" | "unauthorized";
type Tab = "flags" | "announcements" | "surveys";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "flags", label: "Feature Flags", icon: ToggleLeft },
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "surveys", label: "Surveys", icon: ClipboardText },
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
  const [adminStatus, setAdminStatus] = useState<AdminStatus>("checking");
  const [activeTab, setActiveTab] = useState<Tab>("flags");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setAdminStatus(session === null ? "unauthorized" : "checking");
      return;
    }
    setAdminStatus("checking");
    api.admin
      .me()
      .then(() => setAdminStatus("authorized"))
      .catch(() => setAdminStatus("unauthorized"));
  }, [session]);

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

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo className="w-7 h-7" />
          <div>
            <h1 className="text-sm font-black text-slate-900">Aziiki Admin</h1>
            <p className="text-[10px] text-slate-400 font-mono">{session.user.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign out
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6">
        <nav className="flex gap-1.5 mb-6 bg-white border border-slate-200 rounded-2xl p-1.5">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer ${
                  active ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6">
          {activeTab === "flags" && <FeatureFlagsPanel />}
          {activeTab === "announcements" && <AnnouncementsPanel />}
          {activeTab === "surveys" && <SurveysPanel />}
        </div>
      </div>
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-xs text-slate-500">{children}</div>;
}
