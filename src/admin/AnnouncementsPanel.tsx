import React, { useEffect, useState } from "react";
import { Megaphone, PaperPlaneTilt as Send } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { LoadingSwap } from "../components/LoadingSwap";
import { SkeletonAdminItemList } from "../components/Skeleton";

interface AnnouncementRow {
  id: string;
  title: string;
  message: string;
  targetScreen: string;
  isActive: boolean;
  createdAt: string;
  readCount: number;
}

// Kept in sync manually with ANNOUNCEMENT_TARGET_SCREENS in
// src/server/validation/admin.ts and App.tsx's activeTab ids.
const TARGET_SCREEN_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Everywhere (default)" },
  { value: "auth_signin", label: "Sign-in page" },
  { value: "auth_signup", label: "Sign-up page" },
  { value: "dashboard", label: "Scorecard" },
  { value: "billing", label: "Billing & PDFs" },
  { value: "crm", label: "Customer CRM" },
  { value: "wealth", label: "Wealth & Goals" },
  { value: "stock", label: "Warehouse Stock" },
  { value: "purchaseOrders", label: "Purchase Orders" },
  { value: "team", label: "Team" },
  { value: "exchangeRates", label: "Exchange Rates" },
  { value: "reports", label: "Reports & Wisdom" },
  { value: "ai", label: "CFO AI Advisor" },
  { value: "monetize", label: "Updates & Growth" },
  { value: "guide", label: "App Guide & Academy" },
];

function targetScreenLabel(value: string): string {
  return TARGET_SCREEN_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export default function AnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetScreen, setTargetScreen] = useState("all");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.admin.announcements
      .list()
      .then(setAnnouncements)
      .catch(() => setAnnouncements([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSending(true);
    try {
      await api.admin.announcements.create(title, message, targetScreen);
      setTitle("");
      setMessage("");
      setTargetScreen("all");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that announcement.");
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleActive = async (row: AnnouncementRow) => {
    setAnnouncements((prev) => prev.map((a) => (a.id === row.id ? { ...a, isActive: !a.isActive } : a)));
    try {
      await api.admin.announcements.setActive(row.id, !row.isActive);
    } catch {
      load();
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSend} className="border border-slate-200 rounded-2xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Megaphone className="w-3.5 h-3.5" /> Send a new announcement
        </h3>
        <p className="text-[11px] text-slate-500">Shown as a dismissible banner, until dismissed. Pick which screen it shows on below.</p>
        <input
          type="text"
          required
          maxLength={200}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
        />
        <textarea
          required
          maxLength={2000}
          rows={3}
          placeholder="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs resize-none focus:border-emerald-500"
        />
        <div className="space-y-1">
          <label className="text-[9px] font-mono font-bold text-slate-450 uppercase tracking-widest block">Show on</label>
          <select
            value={targetScreen}
            onChange={(e) => setTargetScreen(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none text-xs focus:border-emerald-500"
          >
            {TARGET_SCREEN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-[10px] text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={isSending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" /> {isSending ? "Sending..." : "Send announcement"}
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-800">Sent announcements</h3>
        <LoadingSwap isLoading={loading} skeleton={<SkeletonAdminItemList />}>
        {announcements.length === 0 ? (
          <p className="text-xs text-slate-400">Nothing sent yet.</p>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-bold text-slate-900">{a.title}</p>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    {targetScreenLabel(a.targetScreen)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{a.message}</p>
                <p className="text-[9px] font-mono text-slate-400 mt-1.5">
                  {new Date(a.createdAt).toLocaleString()} · Seen by {a.readCount}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleActive(a)}
                className={`shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer ${
                  a.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}
              >
                {a.isActive ? "Active" : "Inactive"}
              </button>
            </div>
          ))
        )}
        </LoadingSwap>
      </div>
    </div>
  );
}
