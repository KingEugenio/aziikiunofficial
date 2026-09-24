# Setting up PostHog for Aziiki

PostHog already works end-to-end in this codebase — nothing new needs to
be built. This guide is just "where do I get the key, and where do I put
it." Aziiki never sends anything to PostHog until you add your own key.

Claude cannot sign up for PostHog on your behalf (it's a new third-party
account) and the official `npx @posthog/wizard` setup tool needs an
interactive browser login it can't drive for you either — so this is a
short manual version of the same result.

## What's already built

- `src/lib/posthog.ts` — initializes PostHog once, at boot, only if
  `VITE_POSTHOG_KEY` is set. Session recording and autocapture are off by
  default (matching the Privacy Policy's "no session replay" promise) —
  just named events.
- Every place Aziiki already tracks feature usage (`trackFeatureUsage` in
  `src/lib/analytics.ts` — invoices created, reports viewed, AI questions
  asked, and so on) now also sends that same event to PostHog. Nothing
  extra to wire up per feature.
- Signing in/out calls `identifyPostHogUser` / `resetPostHogIdentity`
  automatically, so events are tied to a real person instead of staying
  anonymous, without sending PostHog anything beyond their Supabase user id.

## Step 1: Create a PostHog project

1. Sign up at [posthog.com](https://posthog.com) (free tier is generous —
   1 million events/month at the time of writing).
2. Create a project for Aziiki. Pick the region (US or EU Cloud) that
   matches where your users are, for data residency.
3. In your new project, go to **Project Settings** and copy the **Project
   API Key** (starts with `phc_`).

## Step 2: Add the key

- Local development: paste it into `.env` as `VITE_POSTHOG_KEY=phc_...`
- Production (Vercel): **Project → Settings → Environment Variables**, add
  `VITE_POSTHOG_KEY` with the same value, for Production (and Preview if
  you want analytics there too).
- If your project isn't on US Cloud, also set `VITE_POSTHOG_HOST` to
  `https://eu.i.posthog.com` (EU Cloud) or your self-hosted URL. In
  production, the app's security policy (CSP) only allows `*.i.posthog.com`
  by default, which covers both Cloud regions - a fully custom self-hosted
  domain needs its own entry added next to `posthog` in the `connectSrc`
  list in `src/server/app.ts`, or events will be silently blocked by the
  browser.

**This is a `VITE_` variable**, so — same as `VITE_SUPABASE_URL` — it's
baked in at build time. After adding it in Vercel, redeploy (Deployments →
latest → ⋯ → Redeploy) for it to take effect.

## Step 3: Confirm it's working

1. Open your deployed site and use it for a minute (create an invoice, view
   a report).
2. In PostHog, go to **Activity** (or **Events**) — you should see events
   like `invoicesCreated` / `reportsGenerated` appear within a few seconds.

## When you generate a new key

Same two steps as changing any other key: update it in Vercel's
Environment Variables, then redeploy. A PostHog project API key is
write-only (it can submit events but can't read your data back), so unlike
a database or payment secret there's no urgent rotation window if it's ever
exposed — but generating a fresh one and replacing it is still the right
move if you want to retire an old one.

## What Aziiki does and doesn't send

Sent: the named feature-usage events already listed above, and the
signed-in person's Supabase user id (so events from the same person link
together — no email, name or other personal data is sent).

Not sent, on purpose: session recordings, click/keystroke autocapture, or
page-view tracking. If you want those later, they're a couple of lines to
turn on in `src/lib/posthog.ts` — just make sure the Privacy Policy's "no
session replay" line is updated to match before you do.
