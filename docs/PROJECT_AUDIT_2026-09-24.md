# Aziiki — Project Audit

**Date:** September 24, 2026
**Scope:** the whole app — code, live database, deployment, and everything
configurable from the admin portal.
**Live users right now:** 3 accounts, 4 businesses (this is still pre-launch).

This is a plain-language status report, not a sales pitch. Where something
works, I say so and how I checked. Where something doesn't, I say exactly
what's wrong and what fixing it needs.

---

## 1. Is it fully complete?

**No, and nothing at this scale ever really is — but the core product is
solid and well-tested.** The bookkeeping, invoicing, CRM, inventory, reports,
and AI advisor all work, are typechecked, and covered by 124 automated
tests. What's *not* complete is mostly **configuration**, not code: a few
third-party services have the code wired in but no key entered, and your
live site isn't currently serving the code you've paid for.

The single biggest problem is **#2 below — your live website is broken**,
and it's not something I can fix without access to your Vercel account.

---

## 2. Your live website (aziikiunofficial.vercel.app) is currently broken

Checked just now: it returns a "Server is misconfigured" error, and that
error mentions `UPSTASH_REDIS_REST_URL` and a `PORT` check — those are from
a much older version of this code (before a bug fix from earlier this week).
That means **your live site is not running any of the last several days of
work**, including everything in this audit below.

I cannot see your Vercel dashboard, so I can't tell you *why* the deploys
aren't landing — only that they aren't. **What to check, in your Vercel
project:**

1. **Deployments tab** — is the most recent one green (Ready) or red
   (Failed)? If it's failing, click it and read the build log; that will
   say exactly what broke.
2. **Settings → Environment Variables** — confirm `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` are set for Production. These have been the
   suspected cause since your first report of a blank screen, and I still
   can't confirm they're there.
3. Once you've added/checked those, trigger a fresh deploy (Deployments →
   latest → ⋯ → Redeploy, **without** "Use existing Build Cache").

I'll gladly walk through the build log with you the moment you can share
what it says — I just can't reach it myself.

---

## 3. Do the feature flags actually turn things on and off? — Yes, confirmed live

I tested this for real, not just by reading the code:
- Flipped a flag off in the admin portal, watched the matching tab
  disappear from the sidebar for a Standard-tier test account, flipped it
  back on, watched it reappear.
- Every flag referenced anywhere in the app's code (24 of them) has a
  matching row in the database — nothing is invisible to admin, and
  nothing in admin controls a feature that doesn't exist.

**But here's something you should know:** at **13:16–13:17 today**, every
Phase 2+ flag got switched to **off**, one at a time, a few seconds apart —
that pattern matches someone clicking through the admin Feature Flags
panel by hand, not a script or a bug. If that was you (maybe testing
exactly this "does it work" question), no action needed. If it wasn't, it
means **every feature past the core basics — Wealth & Goals, both games,
Inventory, Purchase Orders, Team, Personal Workspace, and more — is
currently invisible to every real user.** Table below; tell me if you want
me to switch any of these back on.

| Flag | On/off right now | What it controls |
|---|---|---|
| `core_*` (8 flags) | **On** | Scorecard, Billing, CRM, Reports, AI Advisor, Settings, Help, App Guide — the base product |
| `net_worth_investments` | Off | Wealth & Goals tab |
| `inventory_management` | Off | Warehouse Stock tab |
| `four_ways_game` | Off | The "Four Ways to Earn" money game |
| `money_game_feature` | Off | The separate "Money Quiz" game |
| `ad_monetization_hub` | Off | Updates & Growth tab |
| `debts_tracking`, `goals_tracking` | Off | Debts/Goals sections inside Wealth & Goals |
| `signature_capture` | Off | E-signatures on invoices/quotes |
| `brand_kit_advanced_fields` | Off | Extra Brand Kit fields (tax ID, VAT, etc.) |
| `mfa_onboarding_prompt` | Off | The nudge to turn on 2FA (2FA itself always works from Settings) |
| `auth_otp_method` | Off | Signing in with an emailed code instead of a password |
| `multi_business_profiles` | Off | Adding more than one business per account |
| `purchase_orders` | Off | Purchase Orders tab |
| `business_partners_shareholders`, `team_memberships_invite_ui` | Off | Partners/team invite screens |
| `personal_workspace` | Off | The personal (non-business) money tracker |
| `activity_monitoring_enabled` | Off | Admin's Activity Monitoring panel (logging itself is off — harmless either way) |
| `workspace_designer_smart_collapse` | On | Not wired to anything yet — toggling it does nothing (see §6) |

---

## 4. The links — checked one by one

| Link | Status |
|---|---|
| Social icons (Instagram, Facebook, TikTok) in the footer | ✅ All three configured in admin and resolve correctly (checked with a live request to each) |
| Support email (`support@aziiki.com`) | ✅ Works, but see the one inconsistency in §6 |
| Support phone / WhatsApp link | ⚪ Not set yet — the app correctly just hides these when empty, nothing broken |
| "Upgrade to Standard/Pro" button | ⚪ Correctly hidden — no payment page is configured yet (see §5) |
| Live market data source links (Wealth & Goals) | ✅ Code-verified: every link shown is one the search actually used, never invented |
| Internal navigation (every sidebar/tab link) | ✅ All working, including the newly merged ones |

Nothing I found is a **broken** link (a real 404 or dead URL). The gaps are
things nobody's filled in yet, and the app handles that gracefully by
hiding them rather than showing something broken.

---

## 5. Payments: Paystack is not usable yet

- The secret key you pasted in chat two conversations ago was **never**
  added anywhere (I don't handle secrets that way) — please generate a new
  one in Paystack regardless, since it's now sitting in this chat history.
- Right now, **no** Paystack key is set, locally or (as far as I can tell)
  in Vercel.
- **No subscription plan prices or payment page links are configured** —
  the `subscription_plans` table is empty. Even with a key added, nobody
  could actually upgrade yet.
- What to do: [docs/paystack-setup-guide.md](paystack-setup-guide.md) — Step 1
  (new key → Vercel), Step 3 (create Payment Pages in Paystack, then enter
  the price + link for Standard and Pro in **Admin Portal → Payments**).

---

## 6. Smaller things worth fixing

- **`AdMonetizationHub.tsx`, line ~440:** the support email there is
  hardcoded (`support@aziiki.com`) instead of reading your configurable
  setting like the rest of the app does — there's even a `// TODO` comment
  already sitting on that line. Harmless today (it happens to match), but
  if you ever change your support address in Admin → Site Content, this one
  spot won't follow. Small fix, I can do it whenever you like.
- **`workspace_designer_smart_collapse` flag exists but does nothing.** It
  was added by an earlier session alongside the mobile-responsiveness work,
  but nothing in the code reads it. Either I wire it to a real behavior, or
  we remove it from the admin panel so it stops looking like a working
  toggle.
- **Two "money games" now exist** (Four Ways to Earn, Money Quiz) with
  separate admin toggles — intentional, from merging two sessions' work,
  not a mistake. Worth deciding if you actually want both live, or just one.

## 7. Things that work, but depend on external services

| Service | Configured locally? | Status |
|---|---|---|
| Supabase (database, auth) | ✅ | Working — this whole audit ran against it |
| Sentry (error monitoring) | ✅ | Configured; I haven't independently forced a test error to confirm delivery |
| Resend (email) | ✅ | Configured; I haven't sent a live test email this session |
| PostHog (analytics) | ✅ | **Verified working** — confirmed a real event reaches your project from a live test |
| Gemini AI (CFO Advisor, live market data) | ✅ keys present | Last confirmed test hit **quota exceeded** on all 3 keys. Couldn't retest just now — this sandbox's network can't reach Google's API at the moment. Worth you checking directly, since if quota is still exhausted, the AI Advisor and live market data are both silently degrading to "unavailable" (by design — never fake data, but also never useful until quota resets or you upgrade the Gemini plan). |
| Paystack (payments) | ❌ | Not usable yet — see §5 |

---

## 8. Code health (verified just now)

- **TypeScript:** compiles clean, zero errors.
- **Tests:** 124 automated tests. 122–124 pass on any given run — the
  occasional 1–2 failures are real-database integration tests (deliberately
  not mocked) that can time out when many run in parallel against Supabase
  at once; each one passes cleanly when run alone. Not a code bug, just
  test-suite friction under load.
- **Desktop app:** Mac (Intel + Apple Silicon) and Windows installers are
  current — v1.2.0, rebuilt after the biggest merge, confirmed it launches
  and serves the latest code.

---

## 9. Known, deliberate limitations (not bugs — decisions worth knowing about)

- **Locked invoices/receipts are enforced by the API only.** Someone
  technical, signed in, calling Supabase directly with their own login
  token, could bypass the "give a reason" rule. Closing this needs database
  triggers — I outlined this before and can build it if you want it.
- **Amending a receipt's amount doesn't adjust the matching ledger income
  entry.** The amendment itself and its history are recorded correctly;
  the linked transaction total isn't recalculated.
- **The Book Library / Four Ways to Earn game were built with real care
  around copyright** (original wording only, no quotes, tests enforce it),
  but that's careful practice, not a lawyer's sign-off. Worth a real IP
  check before this is commercial and public.
- **A service worker exists in `public/` but is deliberately never
  registered** — it was added by the other branch but its caching strategy
  could reintroduce the "stale white screen" bug already fixed once.
  Left in place, inert, on purpose.

---

## 10. My recommended order of attack

1. **Fix the live deploy** (§2) — nothing else matters until real users can
   reach the site at all.
2. **Decide about the flags** (§3) — turn back on what you want visible.
3. **Paystack** (§5), if you want to accept real subscriptions soon.
4. **Gemini quota** (§7) — check your own Google AI Studio/Cloud console
   for the actual quota status; I can't reach it from here right now.
5. Everything in §6 — small, whenever convenient.
