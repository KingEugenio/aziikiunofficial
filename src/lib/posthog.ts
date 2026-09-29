import posthog from "posthog-js";

/**
 * Client-side product analytics (PostHog) - entirely no-op until a key is
 * configured, same fail-open convention as initSentry() in lib/sentry.ts: an
 * unconfigured integration must never break the app for everyone else.
 *
 * Two sources, checked in order: VITE_POSTHOG_KEY (a build-time env var, for
 * whoever prefers that) or - the primary path now - the admin-editable
 * site_settings keys (posthog_enabled/posthog_key/posthog_host), fetched at
 * boot from the same public /api/config/site-settings endpoint the rest of
 * the app already uses for branding/support links. This lets an admin turn
 * analytics on/off or rotate the key from the admin portal with no rebuild.
 * Call once, at boot, before the app renders.
 */
let enabled = false;

export async function initPostHog(): Promise<void> {
  const envKey = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  let key = envKey;
  let host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com";

  if (!key) {
    try {
      const res = await fetch("/api/config/site-settings");
      if (res.ok) {
        const { data } = (await res.json()) as { data?: Record<string, string> };
        if (data?.posthog_enabled === "true" && data.posthog_key) {
          key = data.posthog_key;
          host = data.posthog_host || host;
        }
      }
    } catch {
      // No network / API down - fall through to no-op, same as everything else here.
    }
  }

  if (!key) return;

  posthog.init(key, {
    // EU or US PostHog Cloud, or a self-hosted instance - whatever the
    // project's own dashboard shows under Project Settings.
    api_host: host,
    // Aziiki already asks for 18+/terms consent at signup and states in the
    // Privacy Policy that there is no session replay - matching that here:
    // events only, no recordings, no autocapture of every click/keystroke.
    disable_session_recording: true,
    capture_pageview: false,
    autocapture: false,
    person_profiles: "identified_only",
  });
  enabled = true;
}

/** Reports a product event to PostHog if it's configured; always safe to call. */
export function capturePostHogEvent(event: string, properties?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    posthog.capture(event, properties);
  } catch {
    // An analytics failure must never break the feature it's describing.
  }
}

/**
 * Ties later events to a real signed-in person instead of an anonymous
 * device id - call right after a successful login/signup. No-ops the same
 * way as everything else here when PostHog isn't configured.
 */
export function identifyPostHogUser(userId: string, properties?: Record<string, unknown>): void {
  if (!enabled) return;
  try {
    posthog.identify(userId, properties);
  } catch {
    // Ignore - see capturePostHogEvent above.
  }
}

/** Clears the identified person on sign-out, so the next session starts anonymous. */
export function resetPostHogIdentity(): void {
  if (!enabled) return;
  try {
    posthog.reset();
  } catch {
    // Ignore - see capturePostHogEvent above.
  }
}
