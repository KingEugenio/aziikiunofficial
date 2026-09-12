import { api } from "./api";
import { useCachedResource } from "./sessionCache";

/**
 * The admin-uploaded logo/favicon (see /admin -> Branding & Files and
 * migration 0035). Cached for 15 minutes (see sessionCache.ts) instead of
 * re-fetched on every mount - BrandLogo.tsx renders in many places at
 * once (every screen's header/sidebar), which used to mean that many
 * independent requests for the exact same data. Public endpoint - has to
 * work before anyone signs in, since the favicon and the sign-in screen's
 * own logo both need it immediately.
 */
export function useBranding() {
  const { data, loaded } = useCachedResource("aziiki_cache_branding", () => api.config.branding());
  return { logoUrl: data?.logoUrl ?? null, loaded };
}
