import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * The admin-uploaded logo/favicon (see /admin -> Branding & Files and
 * migration 0035), fetched once per app load. Public endpoint - has to
 * work before anyone signs in, since the favicon and the sign-in screen's
 * own logo both need it immediately.
 */
export function useBranding() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.config
      .branding()
      .then((res) => {
        if (!cancelled) setLogoUrl(res.logoUrl);
      })
      .catch(() => {
        // Fail open to the built-in mark - a missing/unreachable branding
        // endpoint should never block rendering.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { logoUrl, loaded };
}
