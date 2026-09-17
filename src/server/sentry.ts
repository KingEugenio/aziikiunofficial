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
    // This app calls Sentry.init() inline in app.ts rather than via a
    // separate --import'd file, so Sentry's auto-instrumentation (which
    // needs to patch Express before it's ever imported) never applies here
    // - harmless given tracesSampleRate: 0 (no spans to instrument anyway)
    // and error capture already works via setupSentryErrorHandler's
    // explicit middleware below, not auto-instrumentation. This just
    // silences the resulting "Express is not instrumented" warning rather
    // than chasing a --import restructure across three different run
    // contexts (tsx dev, the esbuild-bundled CJS start script, and
    // Vercel's dynamic import) for a warning with nothing missing to fix.
    disableInstrumentationWarnings: true,
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
