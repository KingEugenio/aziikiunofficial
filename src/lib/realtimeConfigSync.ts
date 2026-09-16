import { useEffect } from "react";
import { supabase } from "./supabaseClient";
import { clearCachePrefix } from "./sessionCache";

/**
 * Closes the real gap behind two separate-looking bug reports that turned
 * out to be the same root cause: an admin changes something (flips a
 * feature flag, upgrades someone's plan) and the change genuinely writes
 * to the database correctly, but an already-open browser tab has no way
 * to find out - useCachedResource's 15-minute stale-while-revalidate
 * window (see sessionCache.ts) only gets force-cleared today on that
 * SAME tab's own login/logout. A different tab, a different device, or
 * the same tab left open from earlier, would only see the change once
 * that window naturally expires.
 *
 * This subscribes to Postgres changes (via Supabase Realtime) on the
 * three tables that feed GET /api/config/features's response, and clears
 * the cached copy the instant a relevant row changes - so the next
 * render re-fetches for real instead of serving what's now stale data.
 * RLS still applies to these subscriptions (a signed-in user only
 * receives events for rows they're allowed to SELECT), so this can't
 * leak another account's data.
 */
export function useRealtimeConfigSync(userId: string | null | undefined): void {
  useEffect(() => {
    if (!userId) return;

    const invalidate = () => clearCachePrefix("aziiki_cache_features");

    const channel = supabase
      .channel(`config-sync-${userId}`)
      // Every account shares the same feature_flags rows - any change
      // (an admin flipping a flag on/off) matters to everyone signed in.
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_flags" }, invalidate)
      // Per-user rows - only this account's own override changes are
      // relevant, and RLS would filter out anyone else's anyway.
      .on("postgres_changes", { event: "*", schema: "public", table: "user_feature_overrides", filter: `user_id=eq.${userId}` }, invalidate)
      // Covers a tier change (Basic -> Pro from the admin Users panel) -
      // /config/features returns this account's tier in the same response.
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${userId}` }, invalidate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
