import * as Sentry from "@sentry/node";
import type { Express } from "express";
import { env } from "./env";

/**
 * Server-side error monitoring - entirely no-op until SENTRY_DSN is set
 * (same fail-open convention as GEMINI_API_KEY/RESEND_API_KEY/
 * PAYSTACK_SECRET_KEY in env.ts: an unconfigured integration must never
 * change behavior for anyone). Must be called before createApp() builds
 * any Express middleware, per Sentry's own Express integration requirements.
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Conservative default - only error reporting for now, no tracing
    // volume/cost decision has been made yet.
    tracesSampleRate: 0,
  });
}

/**
 * Registers Sentry's error-capturing middleware. Must be called AFTER every
 * route is mounted but BEFORE the app's own final error-handling middleware
 * (see app.ts) - that's Sentry's own required ordering for Express, so it
 * sees every unhandled route error before the app's generic 500 response
 * closes it out. No-ops if Sentry was never initialized.
 */
export function setupSentryErrorHandler(app: Express): void {
  if (!env.SENTRY_DSN) return;
  Sentry.setupExpressErrorHandler(app);
}
