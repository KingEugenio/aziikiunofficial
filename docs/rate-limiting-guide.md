# Rate Limiting in Aziiki

There are two separate layers. One is already built and running - nothing
to activate. The other lives entirely in your Supabase dashboard and is
worth turning on as a second line of defense.

## Layer 1: Aziiki's own rate limiting (already active, no setup needed)

Every sensitive route in Aziiki - login, signup, password reset, OTP,
magic links, the Paystack webhook, the general API - is rate-limited
through `express-rate-limit`, backed by a small Postgres table
(`rate_limit_counters`) in your own Supabase project. This is already
running in production and in local dev; there's no dashboard toggle for
it, no external service to sign up for, and no API key to add.

**Where it's defined:** `src/server/rateLimiters.ts` - eight limiters, one
per sensitive route group, each with its own window and max-attempts
values already tuned (e.g. login: 10 attempts / 15 minutes per IP+email;
signup: 5 / hour per IP; the general API: 300 / 5 minutes per IP).

**How it works:** each limiter uses `PostgresRateLimitStore`
(`src/server/rateLimitStorePostgres.ts`), which atomically increments a
counter via a Postgres function (`rate_limit_increment`, migration 0056) -
the same database every other request in the app already depends on, so
there's no separate piece of infrastructure that can go down independently.
Expired counters get swept nightly by a scheduled job (Vercel Cron in
production, a local timer in dev).

**Login specifically gets a second, stricter layer on top:**
`src/server/security/loginLockout.ts` tracks failed attempts **per
account** (not just per IP), regardless of which IP they come from, and
locks the account with an escalating cooldown (1 min -> 5 min -> 15 min ->
1 hour) after 5 failures in 15 minutes. This is what actually stops
someone from brute-forcing one specific account by spreading attempts
across many IP addresses - the per-IP limiter alone wouldn't catch that.

**If you want to change any of the numbers** (stricter or more lenient),
edit the relevant limiter in `rateLimiters.ts` directly - there's nothing
to reconfigure anywhere else.

Both pieces have real, passing integration tests against the live
database (`src/server/rateLimitStorePostgres.test.ts`,
`src/server/security/loginLockout.test.ts`) - run `npm test` any time to
confirm the counting, windowing, and escalation logic still behaves
correctly.

## Layer 2: Supabase's own built-in Auth rate limits (worth turning on, 2 minutes)

This is a **second, independent layer** - Supabase's own GoTrue auth
server enforces its own limits before a request even reaches Aziiki's
code. It won't conflict with Layer 1; think of it as a project-wide
backstop that protects your Supabase project's infrastructure itself,
while Layer 1 protects individual accounts and routes with more precise
rules.

### How to turn it on

1. Go to your project in [supabase.com/dashboard](https://supabase.com/dashboard).
2. In the left sidebar: **Authentication → Rate Limits**.
3. You'll see a list of limits, most already on by default with generic
   values - review and tighten the ones that matter most for you:

| Setting | Default | What it protects |
|---|---|---|
| Sign-ups and sign-ins | 30 requests / 5 min per IP | Brute-force login/signup attempts |
| Send OTPs or Magic Links | 1 per 60s per user | OTP/magic-link spam to one account |
| Signup confirmation requests | 1 per 60s per user | Repeated confirmation-email requests |
| Password reset requests | 1 per 60s per user | Password-reset email spam |
| Verification requests | 30 / 5 min per IP | Abuse of the `/auth/v1/verify` endpoint |
| Token endpoint requests | 150 / 5 min per IP | Token refresh/exchange abuse |
| SMS messages sent | 30 / hour per project | SMS OTP cost control, if you ever enable phone auth |

4. Adjust any value by clicking it and entering a new number - changes
   apply immediately, no redeploy needed.
5. There's also an **IP Address Forwarding** toggle on this same page -
   turn it on so Supabase rate-limits by your end users' real IPs rather
   than your server's own IP (relevant since Aziiki's backend calls
   Supabase on users' behalf).

**One honest caveat:** there's a known, currently-open Supabase issue
where the "sign-ups and sign-ins" limit specifically doesn't always get
enforced as configured ([supabase/auth#2333](https://github.com/supabase/auth/issues/2333)).
This doesn't weaken your actual security posture here - Aziiki's own
Layer 1 (per-IP AND per-account, with escalating lockout) already covers
that exact case independently. Turn Layer 2 on anyway as the extra
backstop it's meant to be; just don't rely on it alone for that specific
setting.

Sources:
- [Supabase Docs: Rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [supabase/auth#2333 - sign-up/sign-in limit not enforced](https://github.com/supabase/auth/issues/2333)
