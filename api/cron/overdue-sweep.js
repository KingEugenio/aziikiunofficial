// GENERATED FILE - do not edit. Source: src/vercel/cron/overdue-sweep.ts. Rebuild with `npm run build:api`.

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

// src/server/email/resendClient.ts
import { Resend } from "resend";
var client = null;
function isEmailConfigured() {
  return Boolean(env.RESEND_API_KEY);
}
function getClient() {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!client) {
    client = new Resend(env.RESEND_API_KEY);
  }
  return client;
}
var EmailSendError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "EmailSendError";
  }
};
function toUserFacingMessage(code) {
  switch (code) {
    case "invalid_api_key":
    case "restricted_api_key":
    case "missing_api_key":
    case "invalid_from_address":
    case "invalid_region":
    case "security_error":
      return "Email sending isn't set up correctly on this server yet. Please contact support.";
    case "rate_limit_exceeded":
    case "monthly_quota_exceeded":
    case "daily_quota_exceeded":
      return "Too many emails have been sent recently. Please wait a few minutes and try again.";
    case "invalid_parameter":
    case "missing_required_field":
    case "validation_error":
    case "invalid_attachment":
      return "This email couldn't be sent - please check the customer's email address and try again.";
    case "internal_server_error":
    case "application_error":
    case "not_found":
    case "method_not_allowed":
      return "Our email provider is temporarily unavailable. Please try again shortly.";
    default:
      return "We couldn't send this email right now. Please try again shortly.";
  }
}
async function sendTransactionalEmail(params) {
  const resend = getClient();
  let error;
  try {
    ({ error } = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html
    }));
  } catch (err) {
    console.error("[resend] request failed:", err instanceof Error ? err.message : err);
    throw new EmailSendError(toUserFacingMessage(void 0));
  }
  if (error) {
    console.error("[resend] send failed:", error.name, error.message);
    throw new EmailSendError(toUserFacingMessage(error.name));
  }
}

// src/server/email/emailTemplate.ts
function wrapEmailHtml(params) {
  const { preheader = "", bodyHtml } = params;
  return `<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background-color:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <span style="display:none; font-size:1px; color:#f8fafc; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #e2e8f0;">
            <tr>
              <td style="background-color:#006837; padding:24px 28px;">
                <span style="font-size:18px; font-weight:800; color:#ffffff; letter-spacing:-0.02em;">Aziiki</span>
                <div style="font-size:11px; color:#a7f3d0; font-family: monospace; letter-spacing:0.08em; text-transform:uppercase; margin-top:2px;">Your Business. Organized.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px; border-top:1px solid #f1f5f9;">
                <p style="font-size:11px; color:#94a3b8; margin:0; line-height:1.6;">
                  You're receiving this because you have an Aziiki account. If this wasn't you, you can safely ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// src/server/notifications/notify.ts
async function createNotification(params) {
  const supabase = getServiceRoleClient();
  const { data: row, error } = await supabase.from("notification_log").insert({
    user_id: params.userId,
    business_id: params.businessId,
    type: params.type,
    reference_id: params.referenceId ?? null,
    title: params.title,
    message: params.message
  }).select("id").single();
  if (error) {
    console.error("[notifications] failed to log notification:", error.message);
    return;
  }
  if (!isEmailConfigured()) return;
  try {
    await sendTransactionalEmail({
      to: params.recipientEmail,
      subject: params.title,
      html: wrapEmailHtml({
        preheader: params.message,
        bodyHtml: `
          <p style="font-size:17px; font-weight:800; color:#0f172a; margin:0 0 10px;">${params.title}</p>
          <p style="font-size:14px; line-height:1.6; color:#475569; margin:0 0 20px;">${params.message}</p>
          <a href="https://aziiki.com" style="display:inline-block; background-color:#006837; color:#ffffff; font-size:13px; font-weight:700; text-decoration:none; padding:10px 20px; border-radius:10px;">Open Aziiki</a>
        `
      })
    });
    await supabase.from("notification_log").update({ email_sent_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", row.id);
  } catch (err) {
    console.error("[notifications] email send failed:", err instanceof Error ? err.message : err);
  }
}
async function hasExistingNotification(type, referenceId) {
  const supabase = getServiceRoleClient();
  const { count } = await supabase.from("notification_log").select("id", { count: "exact", head: true }).eq("type", type).eq("reference_id", referenceId);
  return Boolean(count && count > 0);
}

// src/server/notifications/overdueInvoiceSweep.ts
async function runOverdueInvoiceSweep() {
  const supabase = getServiceRoleClient();
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const { data: overdueInvoices, error } = await supabase.from("invoices").select("*").neq("status", "Paid").lt("due_date", today);
  if (error) {
    console.error("[overdue sweep] failed to load invoices:", error.message);
    return;
  }
  for (const invoice of overdueInvoices ?? []) {
    try {
      const alreadyNotified = await hasExistingNotification("invoice_overdue", invoice.id);
      if (alreadyNotified) continue;
      const { data: profile } = await supabase.from("profiles").select("email").eq("id", invoice.user_id).maybeSingle();
      if (!profile?.email) continue;
      await createNotification({
        userId: invoice.user_id,
        businessId: invoice.business_id,
        type: "invoice_overdue",
        referenceId: invoice.id,
        title: `Invoice ${invoice.invoice_number} is overdue`,
        message: `Invoice ${invoice.invoice_number} was due on ${invoice.due_date} and hasn't been marked paid yet. Consider following up with your customer.`,
        recipientEmail: profile.email
      });
    } catch (err) {
      console.error("[overdue sweep] failed to process invoice", invoice.id, err instanceof Error ? err.message : err);
    }
  }
}

// src/vercel/cron/overdue-sweep.ts
async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!expected) {
    console.error("[cron/overdue-sweep] CRON_SECRET is not set - refusing to run.");
    res.status(500).json({ error: "Server misconfigured." });
    return;
  }
  if (provided !== expected) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }
  try {
    await runOverdueInvoiceSweep();
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[cron/overdue-sweep] failed:", err);
    res.status(500).json({ error: "Sweep failed." });
  }
}
export {
  handler as default
};
