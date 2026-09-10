import React, { useEffect, useState } from "react";
import { Megaphone, X } from "@phosphor-icons/react";
import { api } from "../lib/api";

/**
 * Shows the newest unread admin announcement (see /admin -> Announcements)
 * to every signed-in user. Separate from NotificationBanner, which is
 * per-business event notifications (overdue invoice, payment received) -
 * this is a one-to-many broadcast channel the admin portal controls.
 */
export default function AnnouncementBanner() {
  const [unread, setUnread] = useState<Array<{ id: string; title: string; message: string }>>([]);
  const [isDismissing, setIsDismissing] = useState(false);

  useEffect(() => {
    api.announcements
      .list()
      .then((rows) => setUnread(rows.filter((r) => !r.read)))
      .catch(() => setUnread([]));
  }, []);

  if (unread.length === 0) return null;

  const latest = unread[0];

  const dismiss = async () => {
    setIsDismissing(true);
    try {
      await api.announcements.markRead(latest.id);
      setUnread((prev) => prev.filter((a) => a.id !== latest.id));
    } catch {
      // Best-effort - if this fails, the banner just stays until reload.
    } finally {
      setIsDismissing(false);
    }
  };

  return (
    <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 text-indigo-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in text-left">
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
