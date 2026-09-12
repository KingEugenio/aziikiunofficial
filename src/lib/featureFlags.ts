import { api } from "./api";
import { useCachedResource } from "./sessionCache";

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
  const isEnabled = (key: string) => flags[key] === true;

  return { flags, isEnabled, loaded, tier };
}
