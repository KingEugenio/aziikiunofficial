import React, { useEffect, useState } from "react";
import { Users, Buildings, Megaphone, ClipboardText, ToggleLeft } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminDashboard } from "../components/Skeleton";

interface Stats {
  totalUsers: number;
  totalBusinesses: number;
  activeAnnouncements: number;
  activeSurveys: number;
  flagsEnabled: number;
}

const CARDS: { key: keyof Stats; label: string; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { key: "totalUsers", label: "Total Users", icon: Users, tone: "bg-emerald-600" },
  { key: "totalBusinesses", label: "Businesses", icon: Buildings, tone: "bg-indigo-600" },
  { key: "activeAnnouncements", label: "Active Announcements", icon: Megaphone, tone: "bg-amber-500" },
  { key: "activeSurveys", label: "Active Surveys", icon: ClipboardText, tone: "bg-rose-500" },
  { key: "flagsEnabled", label: "Flags Enabled", icon: ToggleLeft, tone: "bg-teal-600" },
];

export default function AdminDashboardHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.stats
      .get()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminDashboard />}>
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-black text-slate-900">Overview</h2>
        <p className="text-xs text-slate-500 mt-1">Platform-wide totals, at a glance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((card) => {
          const CardIcon = card.icon;
          const value = stats ? stats[card.key] : undefined;
          return (
            <div key={card.key} className={`${card.tone} rounded-2xl p-5 text-white shadow-sm relative overflow-hidden`}>
              <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-white/70">{card.label}</p>
                  <p className="text-2xl font-black mt-1.5">{value === undefined ? "..." : value.toLocaleString()}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <CardIcon className="w-4.5 h-4.5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50">
        <h3 className="text-xs font-bold text-slate-800 mb-1.5">What each screen does</h3>
        <ul className="text-[11px] text-slate-500 space-y-1 leading-relaxed">
          <li><strong className="text-slate-700">Feature Flags</strong> — turn a Phase 2+ feature on globally, or for specific users first.</li>
          <li><strong className="text-slate-700">Announcements</strong> — broadcast a dismissible banner to every signed-in user.</li>
          <li><strong className="text-slate-700">Surveys</strong> — collect structured feedback and read the results.</li>
          <li><strong className="text-slate-700">Branding & Files</strong> — replace the logo/favicon, and store shared documents.</li>
        </ul>
      </div>
    </div>
    </LoadingSwap>
  );
}
