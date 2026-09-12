import { z } from "zod";

// Every variable here is required for the app to function correctly and
// securely. There are NO fallback defaults for secrets: if one of these is
// missing, the process must refuse to start rather than silently run with
// an insecure or empty value.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5173),

  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(20, "SUPABASE_ANON_KEY is missing or looks truncated"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY is missing or looks truncated"),

  UPSTASH_REDIS_REST_URL: z.string().url("UPSTASH_REDIS_REST_URL must be a valid URL"),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(10, "UPSTASH_REDIS_REST_TOKEN is missing or looks truncated"),

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
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    const message = `Refusing to start: invalid or missing environment configuration.\n${issues}\n\nCopy .env.example to .env and fill in every value (or set them in your hosting platform's env var settings) before starting the server.`;
    // Intentionally fatal: never fall back to an insecure default secret.
    // Throwing (not process.exit()) matters here because this module loads
    // in TWO very different environments - server.ts, a long-running
    // process where exiting immediately is exactly right, AND
    // api/index.ts, a Vercel serverless function where process.exit()
    // forcibly kills the underlying function container instead of
    // producing a normal, loggable error response. A thrown Error lets
    // each entry point decide what "refusing to start" means for it:
    // server.ts catches this once at boot and exits deliberately; Vercel's
    // runtime catches it per-invocation and returns a clean 500 with the
    // message in the function logs, instead of the process dying in a way
    // that can surface as an opaque 404/502 with no diagnosable cause.
    throw new Error(`[FATAL] ${message}`);
  }
  return parsed.data;
}

export const env = loadEnv();
