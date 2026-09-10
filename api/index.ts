// Vercel serverless entry point. Vercel treats any exported Express app
// (or (req, res) => void handler) under /api as a function automatically -
// no app.listen() needed or wanted here, Vercel's runtime calls this
// directly per request.
//
// vercel.json rewrites every /api/* request to this one function, and
// Express's own internal routing (mounted in src/server/app.ts) handles
// which specific route actually matches - so /api/auth/login,
// /api/invoices, etc. all still work exactly as they do locally, just
// running as a function invocation instead of inside a long-lived process.
//
// What this deliberately does NOT do, unlike server.ts:
//   - No Vite dev middleware (this only ever runs built/production).
//   - No static file serving - Vercel's CDN serves dist/ directly
//     (see vercel.json's outputDirectory), which is faster and cheaper
//     than proxying static assets through a function.
//   - No setInterval background sweep - a serverless function only runs
//     while handling a request, so a timer started here would never
//     reliably fire. That job moved to api/cron/overdue-sweep.ts, invoked
//     on a schedule by Vercel Cron instead (see vercel.json's "crons").
import "dotenv/config";
import { createApp } from "../src/server/app";

const app = createApp();

export default app;
