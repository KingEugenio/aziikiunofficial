import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { PostgresRateLimitStore } from "./rateLimitStorePostgres";

/** Key by IP + the email in the request body, when present. Combining both
 * stops two different attacks at once: rotating IPs against one victim
 * email, and spraying many emails from one IP. Falls back to IP alone for
 * routes with no email (e.g. token refresh). */
function ipAndEmailKey(req: Request): string {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return `${ipKeyGenerator(req.ip ?? "unknown")}:${email}`;
}

const standardOptions = {
  standardHeaders: true,
  legacyHeaders: false,
} as const;

/**
 * Login: 10 attempts / 15 min per IP+email.
 * Generous enough that a user who mistypes their password a few times in a
 * row is never blocked, but tight enough to make credential-stuffing and
 * brute-force password guessing impractical. Layered on top of (not instead
 * of) the progressive account lockout in src/server/security/loginLockout.ts.
 */
export const loginLimiter = rateLimit({
  ...standardOptions,
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: ipAndEmailKey,
  store: new PostgresRateLimitStore("login"),
  message: { error: "Too many login attempts. Please wait a few minutes and try again." },
});

/**
 * Signup: 5 accounts / hour per IP.
 * Account creation is rare for a legitimate user (once, ever, per person);
 * this mainly exists to blunt automated mass account creation / spam.
 */
export const signupLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  store: new PostgresRateLimitStore("signup"),
  message: { error: "Too many signup attempts from this network. Please try again later." },
});

/**
 * Password reset requests: 3 / 15 min per IP+email.
 * Kept low because this endpoint sends an email; without a cap it's an easy
 * way to spam a victim's inbox. The route must return the same generic
 * response whether or not the email exists, so this limit is the only
 * signal an attacker gets - it must not vary by outcome either.
 */
export const passwordResetLimiter = rateLimit({
  ...standardOptions,
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: ipAndEmailKey,
  store: new PostgresRateLimitStore("pwreset"),
  message: { error: "Too many password reset requests. Please check your inbox or try again later." },
});

/**
 * Magic link requests: 5 / 15 min per IP+email. Same email-spam concern as
 * password reset, slightly higher ceiling since it's the primary sign-in
 * path for some users rather than a rare recovery action.
 */
export const magicLinkLimiter = rateLimit({
  ...standardOptions,
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: ipAndEmailKey,
  store: new PostgresRateLimitStore("magiclink"),
  message: { error: "Too many sign-in link requests. Please check your inbox or try again later." },
});

/**
 * OTP request + verify: 5 / 10 min per IP+email.
 * OTP codes are short (6 digits) and therefore guessable within a small
 * number of attempts, so both requesting a new code and verifying one share
 * a tight window to prevent brute-forcing the code itself.
 */
export const otpLimiter = rateLimit({
  ...standardOptions,
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: ipAndEmailKey,
  store: new PostgresRateLimitStore("otp"),
  message: { error: "Too many one-time code attempts. Please request a new code shortly." },
});

/**
 * Paystack webhook: 120 / min per IP. This endpoint is public (Paystack
 * calls it directly with no user session), so it needs its own cap
 * independent of the general apiLimiter - generous enough for legitimate
 * bursts of payment notifications, tight enough to blunt someone hammering
 * the endpoint with forged payloads (which still fail signature
 * verification, but the rate limit stops that from being free to attempt).
 */
export const paystackWebhookLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 1000,
  max: 120,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  store: new PostgresRateLimitStore("paystack-webhook"),
  message: { error: "Too many requests." },
});

/**
 * General API traffic: 300 requests / 5 min per IP.
 * Generous enough for normal dashboard usage (multiple resource lists,
 * polling) across a session, while still bounding scripted abuse of
 * unauthenticated or lightly-authenticated endpoints.
 */
export const apiLimiter = rateLimit({
  ...standardOptions,
  windowMs: 5 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "unknown"),
  store: new PostgresRateLimitStore("api"),
});

/** Hourly AI request ceiling per plan tier - a real but noticeably tighter
 * cap on Basic than Standard/Pro, enough to try the feature without it
 * being a full substitute for upgrading. Guests and any account without a
 * resolvable tier get the Basic ceiling, same as everywhere else tiers are
 * checked in this codebase. */
const AI_TIER_LIMITS: Record<string, number> = { basic: 5, standard: 15, pro: 40 };

/**
 * Gemini-backed AI routes (insights, chat, live-investments): keyed by user
 * id when signed in (via optionalAuth, mounted ahead of this limiter on
 * every gemini route), IP otherwise for guests. Every call here is a real,
 * metered LLM API cost, unlike the rest of the API surface - the general
 * apiLimiter (300/5min) is nowhere near tight enough on its own to bound
 * that cost, per the product teardown's "AI CFO Advisor: keep in MVP, but
 * cap usage/cost" call.
 */
export const geminiLimiter = rateLimit({
  ...standardOptions,
  windowMs: 60 * 60 * 1000,
  max: async (req) => {
    if (!req.user || !req.supabase) return AI_TIER_LIMITS.basic;
    try {
      const { data } = await req.supabase.from("profiles").select("tier").eq("id", req.user.id).maybeSingle();
      const tier = data?.tier;
      return (tier && AI_TIER_LIMITS[tier]) ?? AI_TIER_LIMITS.basic;
    } catch {
      // Can't confirm a paid tier - fail closed to the Basic ceiling rather
      // than accidentally granting a higher limit.
      return AI_TIER_LIMITS.basic;
    }
  },
  keyGenerator: (req) => (req.user?.id ? `user:${req.user.id}` : `ip:${ipKeyGenerator(req.ip ?? "unknown")}`),
  store: new PostgresRateLimitStore("gemini"),
  message: { error: "You've reached the hourly limit for AI features. Please try again in a bit." },
});
