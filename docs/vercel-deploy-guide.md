# Deploying Aziiki on Vercel

Every push to `main` on GitHub deploys automatically (the GitHub repo is already
connected to the Vercel project). This guide is about the **environment
variables**, which are the usual reason a Vercel deploy shows a white or blank
screen.

## The short answer

You do **not** need Resend, Sentry, Gemini, Paystack or Upstash keys to get past
a blank screen. Those features simply stay switched off until you add their key.

You **do** need the Supabase variables below. Without them the site cannot start.

## Required (the app will not work without these)

Add each one in Vercel: **Project → Settings → Environment Variables**. Tick
**Production** and **Preview** for each.

| Variable | Where to get it | Used by |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | The browser app (baked in at build time) |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key | The browser app (baked in at build time) |
| `SUPABASE_URL` | Same Project URL as above | The API |
| `SUPABASE_ANON_KEY` | Same `anon` key as above | The API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key. **Secret. Never put this in a `VITE_` variable.** | The API |
| `CRON_SECRET` | Make up a long random string (32+ characters) | Protects the two daily background jobs. Vercel sends it to them automatically. |

### Important: redeploy after adding them

The two `VITE_` variables are baked into the site **when it is built**. Adding
them in Vercel does nothing to a deploy that already exists.

After adding or changing any variable: **Deployments → the latest one → ⋯ →
Redeploy** (untick "Use existing Build Cache").

If a blank page is what you're seeing now, this is almost certainly why: the
build ran before the `VITE_` variables existed. Add them, then redeploy.

## Optional (each one switches on one feature)

| Variable | Turns on |
|---|---|
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Sending invoices/receipts by email |
| `SENTRY_DSN`, `VITE_SENTRY_DSN` | Error monitoring (see `sentry-setup-guide.md`) |
| `GEMINI_API_KEY` (+ `_2`, `_3`) | The CFO AI Advisor and live investment rates |
| `PAYSTACK_SECRET_KEY` | Paid plans (see `paystack-setup-guide.md`) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | A small speed-up for sync. Not needed. |

## Variables you can ignore

If you connected Supabase through Vercel's Integrations page, Vercel may have
added variables starting with `STORAGE_` or `NEXT_PUBLIC_`. Aziiki does not read
them. Leave them alone or delete them, it makes no difference.

## Checking that it worked

1. Open the site. You should see the Aziiki sign-in page, not a blank screen.
2. If a `VITE_` variable is missing, the page now says so on screen
   ("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY") instead of staying blank.
   Add it and redeploy.
3. Visit `/api/config/features` on your site. It should return JSON, not an error.
4. If the page is still blank, wait 12 seconds. Aziiki shows a
   "didn't finish loading" screen with a **Clear saved data & reload** button.
   Open the browser console (right-click → Inspect → Console) and look for a red
   message.

## Why the build looks unusual

Vercel's serverless functions can't load the app's TypeScript files directly, so
`npm run build:vercel` first bundles the API into `api/index.js` and the two cron
jobs into `api/cron/*.js`. Those generated files are committed on purpose. A test
(`src/vercel/vercelApiBundle.test.ts`) fails if they fall out of date, so after
changing anything under `src/server/`, run:

```bash
npm run build:api
```

and commit the result.
