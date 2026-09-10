import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { listQueuedWrites, removeQueuedWrite, type QueuedWrite } from "./offlineDb";

let isFlushing = false;
const listeners = new Set<() => void>();

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

/**
 * Drives the offline status banner: current online/offline state, how many
 * writes are queued, and whether a flush is actively running. Also wires
 * up the actual triggers - a flush on the browser's 'online' event, and a
 * queue-length refresh after every online/offline change - so mounting
 * this hook anywhere is enough to get real behavior, not just a readout.
 */
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refreshCount = () => {
      getQueuedWriteCount().then(setPendingCount);
    };
    const onSyncEvent = () => {
      setSyncing(isFlushing);
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

    refreshCount();
    if (navigator.onLine) flushOfflineQueue();

    return () => {
      listeners.delete(onSyncEvent);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, pendingCount, syncing };
}
