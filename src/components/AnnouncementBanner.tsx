import React, { useEffect, useState } from "react";
import { Megaphone, X } from "@phosphor-icons/react";
import { api } from "../lib/api";

interface AnnouncementBannerProps {
  /** Which screen this instance is mounted on - matches App.tsx's activeTab
   * ids, or "auth_signin"/"auth_signup" for the pre-auth screen. An
   * announcement targeted at "all" always shows; anything else only shows
   * when it matches this exact screen. */
  screen: string;
  /** false on the sign-in/sign-up screen, where there's no signed-in user
   * yet - uses the public endpoint and dismisses locally instead of via a
   * server-side "mark read". */
  authenticated?: boolean;
  className?: string;
}

const LOCAL_DISMISS_KEY = "aziiki_dismissed_public_announcements";

function readLocalDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function addLocalDismissed(id: string) {
  try {
    const next = readLocalDismissed();
    next.add(id);
    localStorage.setItem(LOCAL_DISMISS_KEY, JSON.stringify([...next]));
  } catch {
    // Best-effort - localStorage can throw in private-browsing contexts.
  }
}

/**
 * Shows the newest unread admin announcement targeted at this screen (see
 * /admin -> Announcements) to whoever is looking at it. Separate from
 * NotificationBanner, which is per-business event notifications (overdue
 * invoice, payment received) - this is a one-to-many broadcast channel the
 * admin portal controls, including which screen it appears on.
 */
export default function AnnouncementBanner({ screen, authenticated = true, className }: AnnouncementBannerProps) {
  const [rows, setRows] = useState<Array<{ id: string; title: string; message: string; targetScreen: string }>>([]);
  const [locallyDismissed, setLocallyDismissed] = useState<Set<string>>(() => (authenticated ? new Set() : readLocalDismissed()));
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    const fetcher = authenticated
      ? api.announcements.list().then((all) => all.filter((r) => !r.read))
      : api.announcements.public();
    fetcher.then(setRows).catch(() => setRows([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated]);

  const matching = rows.filter((r) => (r.targetScreen === "all" || r.targetScreen === screen) && !locallyDismissed.has(r.id));

  if (matching.length === 0) return null;

  const latest = matching[0];

  const dismiss = async () => {
    setIsDismissing(true);
    try {
      if (authenticated) {
        await api.announcements.markRead(latest.id);
      } else {
        addLocalDismissed(latest.id);
        setLocallyDismissed((prev) => new Set(prev).add(latest.id));
      }
      setRows((prev) => prev.filter((a) => a.id !== latest.id));
    } catch {
      // Best-effort - if this fails, the banner just stays until reload.
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div
      className={`bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-indigo-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in text-left ${className ?? "mb-6"}`}
    >
      <div className="flex items-start gap-3">
        <div className="bg-indigo-100 text-indigo-700 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
          <Megaphone className="w-4.5 h-4.5" />
        </div>
        <div>
          <p className="text-xs font-extrabold">{latest.title}</p>
          <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">{latest.message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={dismiss}
        disabled={isDismissing}
        className="shrink-0 flex items-center gap-1 bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-bold text-[10px] px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" /> Dismiss
      </button>
    </div>
  );
}
