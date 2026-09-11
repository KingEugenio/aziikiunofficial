import React, { useEffect, useState } from "react";
import { WifiSlash, CloudArrowUp, CloudCheck, WarningCircle as AlertCircle, ArrowsClockwise as RefreshCw, X } from "@phosphor-icons/react";
import { useOfflineSync } from "../lib/offlineSync";

/**
 * The visible half of the offline-sync engine (see src/lib/offlineDb.ts +
 * offlineSync.ts for the storage/replay side). Renders nothing in the
 * common case (online, nothing queued, nothing dropped) - only appears
 * when there's something to actually tell the person: they've gone
 * offline, changes are waiting, a batch just finished syncing, or a queued
 * change was rejected outright (not a network problem - the server itself
 * said no, so retrying it automatically forever wouldn't help).
 */
export default function OfflineStatusBanner() {
  const { isOnline, pendingCount, syncing, dropped, retryNow, dismissDropped } = useOfflineSync();
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

  const droppedBanner = dropped.length > 0 && (
    <div className="mb-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 shadow-sm flex items-start gap-3 animate-fade-in text-left">
      <div className="bg-rose-100 text-rose-600 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
        <AlertCircle className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-extrabold">
          {dropped.length} change{dropped.length === 1 ? "" : "s"} couldn't be saved
        </p>
        <p className="text-[11px] text-rose-700 mt-0.5">
          The server rejected {dropped.length === 1 ? "this change" : "these changes"} when it came back online (not a connection
          problem) - it may need to be redone.
        </p>
      </div>
      <button
        type="button"
        onClick={dismissDropped}
        aria-label="Dismiss"
        className="text-rose-400 hover:text-rose-700 cursor-pointer shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  if (isOnline && pendingCount === 0 && !syncing && !showSyncedFlash) {
    return droppedBanner || null;
  }

  if (!isOnline) {
    return (
      <>
        {droppedBanner}
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
      </>
    );
  }

  if (syncing || pendingCount > 0) {
    return (
      <>
        {droppedBanner}
        <div className="mb-6 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-2xl p-4 shadow-sm flex items-center gap-3 animate-fade-in text-left">
          <div className="bg-indigo-100 text-indigo-700 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
            <CloudArrowUp className="w-4.5 h-4.5" />
          </div>
          <p className="text-xs font-extrabold flex-1">
            Syncing {pendingCount > 0 ? `${pendingCount} change${pendingCount === 1 ? "" : "s"}` : "your changes"}...
          </p>
          {pendingCount > 0 && !syncing && (
            <button
              type="button"
              onClick={() => retryNow()}
              className="text-indigo-700 hover:text-indigo-900 cursor-pointer shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry now
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {droppedBanner}
      <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 shadow-sm flex items-center gap-3 animate-fade-in text-left">
        <div className="bg-emerald-100 text-emerald-700 w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
          <CloudCheck className="w-4.5 h-4.5" />
        </div>
        <p className="text-xs font-extrabold">All changes synced.</p>
      </div>
    </>
  );
}
