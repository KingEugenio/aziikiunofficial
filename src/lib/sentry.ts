import * as Sentry from "@sentry/react";

/**
 * Client-side error monitoring - entirely no-op until VITE_SENTRY_DSN is
 * set (same fail-open convention as isEmailConfigured()/isPaystackConfigured()
 * on the server: an unconfigured integration must never break the app for
 * everyone else). Call once, at boot, before the app renders.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Conservative defaults - this app has no performance/replay licence
    // decision made yet, so only error reporting is turned on for now.
    tracesSampleRate: 0,
  });
}

/** Reports an error to Sentry if it's configured; always safe to call. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
