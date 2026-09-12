import { api } from "./api";
import { useCachedResource } from "./sessionCache";

/**
 * Admin-editable site settings (support contact, social links, legal text -
 * see /admin -> Site Content and migration 0047). Cached for 15 minutes
 * (see sessionCache.ts) instead of re-fetched on every mount - Footer.tsx,
 * HelpSupportPage.tsx and LegalTextPage.tsx each used to fetch this same
 * map independently. Public endpoint - the footer and pre-login Help links
 * need it before anyone signs in.
 */
export function useSiteSettings() {
  const { data, loaded } = useCachedResource("aziiki_cache_site_settings", () => api.config.siteSettings());
  return { settings: data ?? {}, loaded };
}
