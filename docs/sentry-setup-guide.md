# Setting Up Sentry for Aziiki

Sentry (error monitoring — it tells you when something breaks in
production, with the actual stack trace, instead of you finding out from
a user's complaint) is **already fully wired into the code**
(`src/server/sentry.ts`, `src/lib/sentry.ts`, `ErrorBoundary.tsx`). It's
just sitting inactive because it needs two DSN values from your own
Sentry account — nothing to build, just two values to paste in.

A video walkthrough, if you'd rather watch than read:
[How to authorize with Sentry DSN and auth tokens - Detailed Guide](https://www.youtube.com/watch?v=BlChdWK2XGc)

## Step-by-step (if you'd rather read)

1. Create a free account at [sentry.io](https://sentry.io) (the free tier
   is genuinely enough for a project this size to start with).
2. Create **two** projects — Aziiki needs one DSN for the server and a
   separate one for the browser:
   - One project with platform **Node.js / Express** → this gives you the
     **server** DSN.
   - One project with platform **React** → this gives you the **browser**
     DSN.
   (You can also use one combined project if you prefer — Sentry supports
   that too — but two keeps server errors and browser errors cleanly
   separated in Sentry's own dashboard, which is usually easier to work
   with.)
3. For each project: **Settings → Projects → [your project] → Client Keys
   (DSN)** — copy the DSN shown there. It looks like
   `https://abc123@o000000.ingest.sentry.io/0000000`.

## Where the two values go

- **Server DSN** → `SENTRY_DSN` — set this in `.env` locally, and in
  Vercel's **Project → Settings → Environment Variables** for production.
- **Browser DSN** → `VITE_SENTRY_DSN` — same two places. This one is safe
  to expose publicly (a `VITE_`-prefixed value ends up in the browser
  bundle either way) — a Sentry DSN can only *submit* new error events, it
  can't be used to read anything back out.

That's genuinely it. The moment both are set and the app restarts (local)
or redeploys (Vercel), errors start flowing into your Sentry dashboard —
no code changes needed on either side.

## One more thing worth doing in Sentry's own dashboard (not in this codebase)

Set up an **Alert Rule** so you actually get notified instead of having to
check Sentry manually: **Alerts → Create Alert → "A new issue is
created"** → pick email or Slack. This is entirely a Sentry-side setting,
nothing to configure in Aziiki for it.

## Confirming it's working

Once both DSNs are set:
- **Server**: trigger any unhandled server error (or just check Sentry's
  dashboard after a normal deploy — Sentry pings itself once on init) and
  it should appear under your Node.js project's Issues tab.
- **Browser**: open the app, open the browser console, and run
  `throw new Error("test")` — it should show up under your React
  project's Issues tab within a few seconds.

Sources:
- [How to authorize with Sentry DSN and auth tokens - Detailed Guide](https://www.youtube.com/watch?v=BlChdWK2XGc)
- [Sentry: Where can I find my DSN?](https://forum.sentry.io/t/where-can-i-find-my-dsn/4877)
- [Sentry docs: Add the Sentry SDK to Your Project](https://docs.sentry.io/guides/integrate-frontend/initialize-sentry-sdk)
