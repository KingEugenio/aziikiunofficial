import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * Computed feature-flag set for the current caller (global defaults with
 * their own per-user overrides layered on top - see GET /api/config/features
 * and migration 0032). Fetched once per app load; a flag flip from the admin
 * portal takes effect on the user's next reload/tab switch, not live -
 * there's no push channel for it and none is needed for this use case.
 */
export function useFeatureFlags() {
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.config
      .features()
      .then((res) => {
        if (!cancelled) setFlags(res.flags ?? {});
      })
      .catch(() => {
        // Fail closed: an unreachable config endpoint means every
        // Phase-2+ feature stays hidden rather than risk showing something
        // half-configured.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isEnabled = (key: string) => flags[key] === true;

  return { flags, isEnabled, loaded };
}
