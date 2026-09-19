// Vercel serverless entry point. Vercel treats any exported (req, res) =>
// void handler under /api as a function automatically - no app.listen()
// needed or wanted here, Vercel's runtime calls this directly per request.
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
import type { Request, Response } from "express";
import type { Express } from "express";

// createApp() (and the env.ts it transitively imports) is loaded lazily,
// inside the handler's own try/catch below, rather than at the top of this
// module. A missing/invalid required env var (SUPABASE_*, UPSTASH_*) makes
// env.ts throw - if that throw happened at plain top-level import time here,
// the WHOLE function module would fail to evaluate on cold start, which is
// exactly the kind of failure that can surface to a caller as an opaque
// crash with no readable error (what this app was hitting on a fresh
// Vercel deploy missing one of the required env vars). Catching it here
// instead means every request - even while misconfigured - gets a real,
// diagnosable JSON error response.
let appPromise: Promise<Express> | null = null;

function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = import("../server/app")
      .then(({ createApp }) => createApp())
      .catch((err) => {
        // Let the next request try again too, in case env vars get fixed
        // without a redeploy (e.g. a platform that hot-reloads env changes) -
        // don't permanently cache a failure.
        appPromise = null;
        throw err;
      });
  }
  return appPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await getApp();
    app(req, res);
  } catch (err) {
    console.error("[api/index] failed to initialize the app - check environment variables:", err);
    res.status(500).json({
      error: "Server is misconfigured - check the deployment's environment variables.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
