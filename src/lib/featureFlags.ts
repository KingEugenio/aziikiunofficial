import { api } from "./api";
import { useCachedResource } from "./sessionCache";

/**
 * Whether a flag counts as on, given whatever flags map we currently have
 * (possibly empty: request failed, not loaded yet, or no server reachable).
 *
 * The eight "core_*" screens (Scorecard, Billing, CRM, Reports, AI, Guide,
 * Settings, Help) are Phase 1 - always on unless an admin explicitly turns
 * one off. They must therefore default to ON when the response is missing,
 * not off: failing closed here hid the ENTIRE app - the sidebar rendered
 * with no Scorecard/CRM/anything - for exactly the people who couldn't reach
 * the server (e.g. a desktop install with no server URL set). Every other
 * (Phase 2+) flag stays opt-in: only an explicit `true` turns it on.
 */
export function isFlagEnabled(flags: Record<string, boolean>, key: string): boolean {
  return key.startsWith("core_") ? flags[key] !== false : flags[key] === true;
}

/**
 * Computed feature-flag set for the current caller (global defaults with
 * their own per-user overrides layered on top - see GET /api/config/features
 * and migration 0032). Cached for 15 minutes (stale-while-revalidate, see
 * sessionCache.ts) instead of re-fetched on every mount - a flag flip from
 * the admin portal reaches an already-open session within that window
 * rather than needing every component remount to pay for a fresh request.
 */
export function useFeatureFlags() {
  const { data, loaded } = useCachedResource("aziiki_cache_features", () => api.config.features());

  const flags = data?.flags ?? {};
  const tier = data?.tier ?? "basic";
  const isEnabled = (key: string) => isFlagEnabled(flags, key);

  return { flags, isEnabled, loaded, tier };
}
