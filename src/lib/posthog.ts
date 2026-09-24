import posthog from "posthog-js";

/**
 * Client-side product analytics (PostHog) - entirely no-op until
 * VITE_POSTHOG_KEY is set, same fail-open convention as initSentry() in
 * lib/sentry.ts: an unconfigured integration must never break the app for
 * everyone else, and nothing here requires Aziiki to hold a PostHog account
 * or key on the codebase's own behalf - whoever deploys this sets their own.
 * Call once, at boot, before the app renders.
 */
export function initPostHog(): void {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
  if (!key) return;

  posthog.init(key, {
    // EU or US PostHog Cloud, or a self-hosted instance - whatever the
    // project's own dashboard shows under Project Settings.
    api_host: (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://us.i.posthog.com",
    // Aziiki already asks for 18+/terms consent at signup and states in the
    // Privacy Policy that there is no session replay - matching that here:
    // events only, no recordings, no autocapture of every click/keystroke.
    disable_session_recording: true,
    capture_pageview: false,
    autocapture: false,
    person_profiles: "identified_only",
  });
}

/** Reports a product event to PostHog if it's configured; always safe to call. */
export function capturePostHogEvent(event: string, properties?: Record<string, unknown>): void {
  if (!import.meta.env.VITE_POSTHOG_KEY) return;
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
  if (!import.meta.env.VITE_POSTHOG_KEY) return;
  try {
    posthog.identify(userId, properties);
  } catch {
    // Ignore - see capturePostHogEvent above.
  }
}

/** Clears the identified person on sign-out, so the next session starts anonymous. */
export function resetPostHogIdentity(): void {
  if (!import.meta.env.VITE_POSTHOG_KEY) return;
  try {
    posthog.reset();
  } catch {
    // Ignore - see capturePostHogEvent above.
  }
}
