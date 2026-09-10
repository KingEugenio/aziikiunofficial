import React, { useEffect, useState } from "react";
import { WifiSlash, CloudArrowUp, CloudCheck } from "@phosphor-icons/react";
import { useOfflineSync } from "../lib/offlineSync";

/**
 * The visible half of the offline-sync engine (see src/lib/offlineDb.ts +
 * offlineSync.ts for the storage/replay side). Renders nothing in the
 * common case (online, nothing queued) - only appears when there's
 * something to actually tell the person: they've gone offline, changes
 * are waiting, or a batch just finished syncing.
 */
export default function OfflineStatusBanner() {
  const { isOnline, pendingCount, syncing } = useOfflineSync();
  const [showSyncedFlash, setShowSyncedFlash] = useState(false);
  const [prevPending, setPrevPending] = useState(pendingCount);

  useEffect(() => {
    if (prevPending > 0 && pendingCount === 0 && isOnline) {
      setShowSyncedFlash(true);
      const t = setTimeout(() => setShowSyncedFlash(false), 3000);
      return () => clearTimeout(t);
    }
    setPrevPending(pendingCount);
  }, [pendingCount, isOnline, prevPending]);

  if (isOnline && pendingCount === 0 && !syncing && !showSyncedFlash) return null;

  if (!isOnline) {
    return (
      <div className="mb-6 bg-slate-800 text-white rounded-2xl p-4 shadow-sm flex items-center gap-3 animate-fade-in text-left">
        <div className="bg-white/10 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
          <WifiSlash className="w-4.5 h-4.5" />
        </div>
        <div>
          <p className="text-xs font-extrabold">You're offline</p>
          <p className="text-[11px] text-slate-300 mt-0.5">
            {pendingCount > 0
              ? `You can keep working - ${pendingCount} change${pendingCount === 1 ? "" : "s"} will sync automatically once you're back online.`
              : "You can keep working - changes will sync automatically once you're back online."}
          </p>
        </div>
      </div>
    );
  }

  if (syncing || pendingCount > 0) {
    return (
      <div className="mb-6 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl p-4 shadow-sm flex items-center gap-3 animate-fade-in text-left">
        <div className="bg-indigo-100 text-indigo-700 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
          <CloudArrowUp className="w-4.5 h-4.5" />
        </div>
        <p className="text-xs font-extrabold">
          Syncing {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? "" : "s"}` : "your changes"}...
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 shadow-sm flex items-center gap-3 animate-fade-in text-left">
      <div className="bg-emerald-100 text-emerald-700 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
        <CloudCheck className="w-4.5 h-4.5" />
      </div>
      <p className="text-xs font-extrabold">All changes synced.</p>
    </div>
  );
}
