import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { listQueuedWrites, removeQueuedWrite, type QueuedWrite } from "./offlineDb";

let isFlushing = false;
const listeners = new Set<() => void>();

// In-memory only (not IndexedDB) - a write the server actually rejected on
// replay, kept just long enough to tell the person about it once. Resets on
// reload; the point is surfacing it in this session, not a permanent audit
// log (the server-side error is also always console.error'd).
interface DroppedWrite {
  method: string;
  path: string;
  status: number;
  droppedAt: number;
}
let droppedWrites: DroppedWrite[] = [];

function notify() {
  listeners.forEach((l) => l());
}

/**
 * Replays one queued write directly via fetch - deliberately NOT through
 * api.ts's request(), which would re-enqueue a duplicate entry on a
 * still-offline retry instead of leaving this exact entry alone to try
 * again next time. Returns "ok" (drop from queue), "retry-later" (still
 * offline - stop the flush and keep the rest of the queue for next time),
 * or "dropped" (the server actually responded with a real error - retrying
 * forever won't fix a validation/auth failure, so this is removed and
 * logged rather than stuck in the queue permanently).
 */
async function replayOne(entry: QueuedWrite): Promise<"ok" | "retry-later" | "dropped"> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`/api${entry.path}`, { method: entry.method, headers, body: entry.body });
  } catch {
    return "retry-later";
  }

  if (response.ok) return "ok";

  console.error(`[offline sync] queued ${entry.method} ${entry.path} was rejected on replay (${response.status}) - dropping it.`);
  droppedWrites = [...droppedWrites, { method: entry.method, path: entry.path, status: response.status, droppedAt: Date.now() }];
  return "dropped";
}

/** Replays every queued write in the order it was made, stopping at the
 * first one that still can't reach the network (rather than replaying out
 * of order) so a later dependent write - e.g. a receipt for an invoice
 * created two entries earlier - never replays before the write it depends
 * on. */
export async function flushOfflineQueue(): Promise<void> {
  if (isFlushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  isFlushing = true;
  notify();
  try {
    const queue = await listQueuedWrites();
    for (const entry of queue.sort((a, b) => a.createdAt - b.createdAt)) {
      const result = await replayOne(entry);
      if (result === "retry-later") break;
      await removeQueuedWrite(entry.id);
      notify();
    }
  } finally {
    isFlushing = false;
    notify();
  }
}

export async function getQueuedWriteCount(): Promise<number> {
  return (await listQueuedWrites()).length;
}

export function dismissDroppedWrites(): void {
  droppedWrites = [];
  notify();
}

// Belt-and-suspenders retry: the browser's 'online' event is the primary
// trigger (instant, in useOfflineSync below), but it isn't 100% reliable in
// every browser/network-transition scenario (e.g. a captive portal, or
// connectivity flapping while the tab is backgrounded) - this periodic
// sweep means a queued write never waits longer than this interval once
// the network is actually back, even if the event never fired.
const PERIODIC_RETRY_MS = 45_000;

/**
 * Drives the offline status banner: current online/offline state, how many
 * writes are queued, whether a flush is actively running, and any writes
 * that were dropped after a real (non-network) server rejection. Also
 * wires up the actual triggers - a flush on the browser's 'online' event,
 * a periodic safety-net retry, and a queue-length refresh after every
 * change - so mounting this hook anywhere is enough to get real behavior,
 * not just a readout.
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [dropped, setDropped] = useState<DroppedWrite[]>(droppedWrites);

  useEffect(() => {
    const refreshCount = () => {
      getQueuedWriteCount().then(setPendingCount);
    };
    const onSyncEvent = () => {
      setSyncing(isFlushing);
      setDropped(droppedWrites);
      refreshCount();
    };
    listeners.add(onSyncEvent);

    const handleOnline = () => {
      setIsOnline(true);
      flushOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const intervalId = window.setInterval(() => {
      if (navigator.onLine) flushOfflineQueue();
    }, PERIODIC_RETRY_MS);

    refreshCount();
    if (navigator.onLine) flushOfflineQueue();

    return () => {
      listeners.delete(onSyncEvent);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(intervalId);
    };
  }, []);

  return { isOnline, pendingCount, syncing, dropped, retryNow: flushOfflineQueue, dismissDropped: dismissDroppedWrites };
}
