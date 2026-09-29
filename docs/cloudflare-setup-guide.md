# Deploying Aziiki on Cloudflare (instead of Vercel)

This is the Cloudflare + Supabase-only setup: your static site and your API
both run on Cloudflare Workers, your database stays on Supabase exactly as it
is today, and Vercel isn't involved at all.

**Status: built and tested locally, not deployed yet.** Everything below that
doesn't need your Cloudflare account has already been done and verified
(`npx wrangler dev` boots the whole app, serves the real site, and every API
route was checked against your real database). What's left needs your
Cloudflare login, which I don't have - that's what this guide walks through.

## What actually changed

- `wrangler.jsonc` - Cloudflare's config file (the equivalent of `vercel.json`).
- `src/cloudflare/index.ts` - the new entry point. Wraps your existing Express
  app (unchanged - every route, every rule, same as Vercel and local dev use)
  so it runs on Cloudflare's Workers runtime instead of a Vercel serverless
  function.
- Two small compatibility fixes, both narrowly scoped to the Cloudflare build
  only (Vercel and local dev are untouched):
  - `src/cloudflare/iconvLiteStub.ts` - a dependency Express uses for parsing
    JSON request bodies (`iconv-lite`) currently crashes on Cloudflare's
    runtime due to a real, open bug on their end
    ([cloudflare/workers-sdk#9309](https://github.com/cloudflare/workers-sdk/issues/9309)).
    Aziiki only ever sends/receives UTF-8 JSON, so this swaps in a tiny
    UTF-8-only replacement that sidesteps the bug entirely.
  - `src/cloudflare/sentryNodeStub.ts` - Sentry's Node error-monitoring
    package also crashes on Workers (it tries to auto-instrument Express in
    a way Node-only tooling needs). Error monitoring is switched off on this
    specific deployment for now rather than half-working; Sentry's own
    Cloudflare-native package (`@sentry/cloudflare`) is the real fix, as a
    follow-up.

Nothing about your actual features, routes, or business logic changed - this
is purely the hosting adapter layer, same as `src/vercel/index.ts` already
was for Vercel.

## What you need to do

### 1. Get a Cloudflare account and log in from your computer

If you don't already have one: sign up free at
[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).

Then, in this project's folder:

```bash
npx wrangler login
```

This opens your browser to approve access. One-time.

### 2. Set your production secrets

These are the same values already in your `.env` file - Cloudflare needs its
own copy (never put real secrets in `wrangler.jsonc`, that file is committed
to git). Run each of these once, pasting the real value when prompted:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put APP_URL
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM_EMAIL
```

Add `PAYSTACK_SECRET_KEY` the same way once you have one. `GEMINI_API_KEY_2`/
`GEMINI_API_KEY_3`/`SENTRY_DSN` are optional, same as they are today.

For `APP_URL`, use whatever address you'll actually reach the site at once
step 4 is done (your `*.workers.dev` URL, or your custom domain if you're
attaching one now).

### 3. Deploy

```bash
npm run cf:deploy
```

This builds the site (`vite build`) and pushes everything to Cloudflare. It
prints a URL when it's done - something like
`https://aziiki.<your-subdomain>.workers.dev`. Open it and it should be the
real, working app.

### 4. Point your domain at it (optional, once you're happy with step 3)

If you have a custom domain: Cloudflare dashboard → Workers & Pages → your
Worker → Settings → Domains & Routes → Add → enter your domain. If the
domain's DNS is already on Cloudflare this is one click; if not, Cloudflare
walks you through pointing it there.

### 5. Update anywhere the old Vercel URL was used

- **Paystack webhook URL** (once you're taking payments): Paystack dashboard
  → Settings → API Keys & Webhooks → change the Webhook URL to
  `https://your-new-domain/api/payments/paystack/webhook`.
- **Supabase auth redirect URLs**: Supabase dashboard → Authentication → URL
  Configuration → add your new domain alongside (or instead of) the old one.

### 6. Cron jobs

Already configured (`wrangler.jsonc`'s `triggers.crons`) - the same two daily
jobs Vercel Cron ran (overdue-invoice sweep, rate-limit cleanup) run
automatically once deployed, no extra setup. Unlike Vercel Cron, these don't
need a `CRON_SECRET` at all - Cloudflare calls your code directly, not over
HTTP, so there's no URL for anyone else to guess and trigger.

## Testing locally before you deploy

```bash
npm run cf:dev
```

Copy `.dev.vars.example` to `.dev.vars` first and fill in your real values
(same ones as `.env` - `.dev.vars` is Wrangler's local-only equivalent,
already in `.gitignore`, never uploaded anywhere). This runs the exact same
code Cloudflare will run in production, entirely on your machine.

## About keeping Vercel around

Nothing here removes your existing Vercel deployment - it's still there,
still working, as a fallback. Once you've confirmed the Cloudflare version is
solid in real use, you can remove `vercel.json`, `api/`, and `src/vercel/` -
but that's a deliberate decision for you to make later, not something to do
before you've actually seen Cloudflare handle real traffic.

## Known limitation right now

Server-side error monitoring (Sentry) is off on the Cloudflare deployment
specifically (see `sentryNodeStub.ts` above) - it still works fine on
Vercel/local. Wiring up `@sentry/cloudflare` properly is a reasonable
follow-up once you're confident in the rest of the migration.
