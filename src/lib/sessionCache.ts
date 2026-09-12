import { useEffect, useState } from "react";

/**
 * Stale-while-revalidate cache for cheap, frequently-remounted config
 * fetches (feature flags, branding, site settings) - these were being
 * re-requested from the API on every component mount, not just once per
 * login, since several different components each call their own hook
 * independently. A 15-minute TTL means a flag/branding change from the
 * admin portal still reaches everyone within a bounded window without
 * every page load/remount paying for a fresh round trip.
 *
 * Two layers: an in-memory Map (shared across every hook instance within
 * the same page load - the biggest win, since a dozen components mounting
 * useFeatureFlags() in one page load used to mean a dozen fetches) plus
 * sessionStorage (survives a full page reload within the same tab/session,
 * cleared automatically when the tab closes - appropriate for account-
 * scoped data that shouldn't persist indefinitely like offlineDb's cache).
 */
const TTL_MS = 15 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
}

const memory = new Map<string, CacheEntry<unknown>>();

// Several components can mount in the same tick, before any of them has a
// resolved cache entry to read yet (e.g. BrandLogo renders in the sidebar,
// header, and auth screen all at once) - without this, each would fire its
// own identical request. Tracking the in-flight Promise per key means every
// concurrent caller awaits the SAME request instead of starting their own.
const inFlight = new Map<string, Promise<unknown>>();

function readStorage<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, entry: CacheEntry<T>): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Private mode / storage full / storage blocked - the in-memory layer
    // still works for the rest of this page load, which is what matters most.
  }
}

function getEntry<T>(key: string): CacheEntry<T> | null {
  const mem = memory.get(key) as CacheEntry<T> | undefined;
  if (mem) return mem;
  const stored = readStorage<T>(key);
  if (stored) memory.set(key, stored);
  return stored;
}

function setEntry<T>(key: string, value: T): void {
  const entry: CacheEntry<T> = { value, fetchedAt: Date.now() };
  memory.set(key, entry);
  writeStorage(key, entry);
}

/** Writes a value into the cache directly, as if it had just been fetched -
 * for a one-off fetch that happens outside a React hook (e.g. main.tsx's
 * boot-time favicon swap) but wants to save a subsequent useCachedResource
 * call for the same key from re-fetching moments later. */
export function primeCache<T>(key: string, value: T): void {
  setEntry(key, value);
}

/** Removes every cached entry whose key starts with `prefix` - call on
 * logout (and before a new login) so one account's cached config can never
 * leak into another session in the same browser tab. */
export function clearCachePrefix(prefix: string): void {
  for (const k of Array.from(memory.keys())) {
    if (k.startsWith(prefix)) memory.delete(k);
  }
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(prefix)) sessionStorage.removeItem(k);
    }
  } catch {
    // Nothing more to do - the in-memory layer is already cleared, which
    // covers the rest of this page load.
  }
}

/**
 * Serves a cached value instantly (even if stale) while re-fetching in the
 * background when the cache is missing or older than the TTL - the caller
 * never blocks on network unless nothing has ever been cached for this key.
 */
export function useCachedResource<T>(key: string, fetcher: () => Promise<T>): { data: T | null; loaded: boolean } {
  const cached = getEntry<T>(key);
  const [data, setData] = useState<T | null>(cached?.value ?? null);
  const [loaded, setLoaded] = useState(cached != null);

  useEffect(() => {
    let cancelled = false;
    const entry = getEntry<T>(key);
    const isFresh = entry != null && Date.now() - entry.fetchedAt < TTL_MS;
    if (entry && !cancelled) {
      setData(entry.value);
      setLoaded(true);
    }
    if (isFresh) return; // Cached and fresh enough - no network call needed.

    // Reuse an already-in-flight request for this key rather than starting
    // a second identical one (see the `inFlight` map comment above).
    let request = inFlight.get(key) as Promise<T> | undefined;
    if (!request) {
      request = fetcher().finally(() => inFlight.delete(key));
      inFlight.set(key, request);
    }

    request
      .then((value) => {
        if (cancelled) return;
        setEntry(key, value);
        setData(value);
        setLoaded(true);
      })
      .catch(() => {
        // Leave whatever's already in state (stale cache, or the initial
        // null) - each caller's own fail-open/fail-closed default already
        // applies via whatever it does with a null/empty `data`.
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loaded };
}
