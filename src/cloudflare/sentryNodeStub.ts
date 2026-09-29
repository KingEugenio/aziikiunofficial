// Cloudflare-Workers-only replacement for @sentry/node (aliased in
// wrangler.jsonc, applies to the Cloudflare build only - Vercel and local
// dev keep using the real package unmodified).
//
// @sentry/node's Sentry.init() sets up OpenTelemetry-based auto-
// instrumentation for Express, which tries to monkey-patch Express
// internals in a way that needs Node's real module-loading hooks - not
// available under Workers, and it crashes the whole Worker at startup
// (`this.enable is not a function` inside ExpressInstrumentation) before a
// single request is handled. This is a real Workers-runtime limitation,
// not a bug in this app.
//
// Server-side error monitoring on this Worker is disabled for now rather
// than half-working - Sentry's own Workers-native package (@sentry/cloudflare)
// is the real fix and a reasonable follow-up, but is a separate, deliberate
// integration, not something to bolt on silently while proving out whether
// the rest of the app runs here at all. sentry.ts (src/server/sentry.ts)
// only calls the two functions stubbed below.
export function init(_options: unknown): void {
  console.warn("[sentry] disabled on this Cloudflare Worker build - see src/cloudflare/sentryNodeStub.ts");
}

export function setupExpressErrorHandler(_app: unknown): void {
  // No-op - see the module comment above.
}
