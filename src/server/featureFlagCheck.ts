import { getAnonClient } from "./supabaseClients";

/**
 * A tiny, cached "is this flag globally on" check for server-side code that
 * needs to gate its own behaviour (not just tell the client what to render).
 * Deliberately simpler than /api/config/features: no per-user overrides, no
 * tier ceiling - just enabled_default, which is enough for an admin on/off
 * switch like "log activity at all". Same short TTL pattern as that route's
 * own cache, for the same reason (feature_flags barely ever changes, and
 * every request checking it live would be wasteful).
 */
const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { enabled: boolean; expiresAt: number }>();

export async function isFeatureFlagOn(key: string, fallback = false): Promise<boolean> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.enabled;

  try {
    const { data, error } = await getAnonClient().from("feature_flags").select("enabled_default").eq("key", key).maybeSingle();
    const enabled = error || !data ? fallback : Boolean(data.enabled_default);
    cache.set(key, { enabled, expiresAt: Date.now() + CACHE_TTL_MS });
    return enabled;
  } catch {
    // Never let a flag-check failure block or crash the caller.
    return fallback;
  }
}
