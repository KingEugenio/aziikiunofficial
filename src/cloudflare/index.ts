// Cloudflare Workers entry point - the Cloudflare/Supabase-only equivalent
// of src/vercel/index.ts + api/cron/*.ts combined into one Worker, since
// Workers export a single default object with both fetch (HTTP requests)
// and scheduled (Cron Triggers) handlers, rather than Vercel's one-function-
// per-file convention.
//
// createApp() (src/server/app.ts) is unchanged and shared with every other
// host (local dev via server.ts, Vercel via src/vercel/index.ts) - it was
// already written with no app.listen(), no static serving, and no
// setInterval background jobs, specifically so it could run anywhere.
// Nothing about the actual routes, middleware, or business logic changes
// for Cloudflare; only this adapter layer is new.
//
// How an Express app runs on a Worker at all: Cloudflare's httpServerHandler
// (from the "cloudflare:node" built-in, needs the nodejs_compat +
// enable_nodejs_http_server_modules compatibility flags - see wrangler.jsonc)
// bridges a real Node http.Server into a Workers fetch handler. Express
// itself never has to know it's not running in a normal Node process.
import { httpServerHandler } from "cloudflare:node";
import { createApp } from "../server/app";
import { runOverdueInvoiceSweep } from "../server/notifications/overdueInvoiceSweep";
import { getServiceRoleClient } from "../server/supabaseClients";
import type { Fetcher, ExecutionContext, ScheduledEvent } from "./workersTypes";

const PORT = 8080;

// Built and .listen()'d once per Worker isolate (module scope runs once per
// isolate startup, not per-request) - the same cold-start-friendly pattern
// src/vercel/index.ts uses.
const app = createApp();
app.listen(PORT);
const expressHandler = httpServerHandler({ port: PORT });

interface Env {
  // Static assets binding (see wrangler.jsonc's assets.binding) - dist/,
  // built by `npm run build`, same output Vercel's CDN serves directly.
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    // wrangler.jsonc's assets.run_worker_first already routes /api/* here
    // before falling back to static files - this check is belt-and-suspenders
    // for local `wrangler dev` and any future change to that config.
    if (url.pathname.startsWith("/api/")) {
      return expressHandler.fetch(request, env, ctx);
    }
    // Everything else: dist/'s static files, with SPA fallback to
    // index.html for any client-side route (not_found_handling in
    // wrangler.jsonc), same behavior as Vercel's CDN + rewrites today.
    return env.ASSETS.fetch(request);
  },

  // Cloudflare Cron Triggers call this directly (no HTTP request, no
  // CRON_SECRET header dance like Vercel Cron needed) - event.cron is the
  // exact schedule string from wrangler.jsonc's triggers.crons, so one
  // Worker can host multiple differently-scheduled jobs.
  async scheduled(event: ScheduledEvent, _env: Env, ctx: ExecutionContext): Promise<void> {
    if (event.cron === "0 5 * * *") {
      ctx.waitUntil(runOverdueInvoiceSweep());
      return;
    }
    if (event.cron === "0 3 * * *") {
      ctx.waitUntil(
        (async () => {
          const supabase = getServiceRoleClient();
          const { error } = await supabase.rpc("rate_limit_cleanup_expired");
          if (error) console.error("[cron/rate-limit-cleanup] failed:", error.message);
        })()
      );
      return;
    }
    console.error(`[scheduled] unrecognized cron expression: ${event.cron}`);
  },
};
