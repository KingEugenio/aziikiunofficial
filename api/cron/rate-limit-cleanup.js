// GENERATED FILE - do not edit. Source: src/vercel/cron/rate-limit-cleanup.ts. Rebuild with `npm run build:api`.

// src/server/supabaseClients.ts
import { createClient } from "@supabase/supabase-js";

// src/server/env.ts
import { z } from "zod";
var envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5173),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(20, "SUPABASE_ANON_KEY is missing or looks truncated"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY is missing or looks truncated"),
  // Optional: rate limiting runs on Postgres by default now (see
  // rateLimitStorePostgres.ts / migration 0056), no external service
  // required. These only matter if you specifically want the
  // /api/sync short-TTL read-through cache (redis.ts's cached()) backed
  // by Upstash instead of hitting Postgres directly every time - missing
  // this never blocks startup, the cache just no-ops (every read falls
  // straight through to its loader).
  UPSTASH_REDIS_REST_URL: z.string().url("UPSTASH_REDIS_REST_URL must be a valid URL").optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10, "UPSTASH_REDIS_REST_TOKEN is missing or looks truncated").optional(),
  // Feature-flagged rather than fatal: the AI routes check for this at request
  // time and return a clear 503 if it's absent, so a missing key degrades one
  // feature instead of blocking the whole app from starting.
  GEMINI_API_KEY: z.string().optional(),
  // Optional additional keys for automatic failover when the primary key
  // hits a rate limit (HTTP 429) - see src/server/geminiClient.ts. Only
  // genuinely adds capacity if these come from SEPARATE Google Cloud/AI
  // Studio projects with their own independent quota; multiple keys
  // generated inside the same project typically share one quota pool.
  GEMINI_API_KEY_2: z.string().optional(),
  GEMINI_API_KEY_3: z.string().optional(),
  // Same feature-flagged pattern as GEMINI_API_KEY: emailing invoices/receipts
  // is an optional feature. Missing this never blocks startup - the send-email
  // routes return a clear 503 and the frontend disables the button instead.
  RESEND_API_KEY: z.string().optional(),
  // Not a secret - just the "from" address invoice/receipt emails are sent
  // from. Must be on a domain verified in your Resend account.
  RESEND_FROM_EMAIL: z.string().default("Aziiki <no-reply@aziiki.com>"),
  // Same feature-flagged pattern as GEMINI_API_KEY/RESEND_API_KEY: accepting
  // Paystack payments is optional. Missing this never blocks startup - the
  // payment routes return a clear 503 and the frontend hides the "Request
  // Payment" button instead. Add your real secret key here before hosting;
  // it is never checked into source control.
  PAYSTACK_SECRET_KEY: z.string().optional(),
  // Same feature-flagged pattern as the above: server-side error monitoring
  // is optional. Missing this never blocks startup or changes behavior -
  // Sentry simply never initializes, same as the client's VITE_SENTRY_DSN.
  SENTRY_DSN: z.string().optional()
});
function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    const message = `Refusing to start: invalid or missing environment configuration.
${issues}

Copy .env.example to .env and fill in every value (or set them in your hosting platform's env var settings) before starting the server.`;
    throw new Error(`[FATAL] ${message}`);
  }
  return parsed.data;
}
var env = loadEnv();

// src/server/supabaseClients.ts
function getServiceRoleClient() {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// src/vercel/cron/rate-limit-cleanup.ts
async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected) {
    console.error("[cron/rate-limit-cleanup] CRON_SECRET is not set - refusing to run.");
    res.status(500).json({ error: "Server misconfigured." });
    return;
  }
  if (provided !== expected) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.rpc("rate_limit_cleanup_expired");
    if (error) throw error;
    res.status(200).json({ ok: true, deleted: data ?? 0 });
  } catch (err) {
    console.error("[cron/rate-limit-cleanup] failed:", err);
    res.status(500).json({ error: "Cleanup failed." });
  }
}
export {
  handler as default
};
