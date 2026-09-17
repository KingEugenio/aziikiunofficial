# Setting Up Paystack for Aziiki

Paystack already works end-to-end in this codebase — nothing new needs to
be built. This guide is just "where do I get the values, and where do I
put them," for the two separate things Paystack does in Aziiki:

1. **Collecting payment on an invoice** ("Request Payment" button — money
   from your customers to you).
2. **Upgrading someone's plan** (Basic → Standard/Pro — money from your
   users to you, for using Aziiki itself).

Both use the same Paystack account and the same secret key. You only need
to do the setup below once.

---

## Step 1: Get your Paystack Secret Key

1. Sign in at [dashboard.paystack.com](https://dashboard.paystack.com) (or
   create an account if you don't have one — it's free to sign up, Paystack
   only takes a percentage per real transaction).
2. Go to **Settings → API Keys & Webhooks**.
3. Copy your **Secret Key**. Paystack gives you a **Test** key and a
   **Live** key — use the Test key first while you're trying everything
   out (it won't move real money), then switch to the Live key when you're
   ready for real customers.

**Where it goes:**

- Local development: paste it into `.env` as `PAYSTACK_SECRET_KEY=sk_test_...`
- Production (Vercel): **Project → Settings → Environment Variables**, same
  variable name, same value (use your Live key here once you're ready).

That single key is what makes both invoice payments and plan upgrades work
— once it's set, `isPaystackConfigured()` returns true everywhere in the
app and the "Request Payment" button stops being hidden.

## Step 2: Point Paystack's webhook at your app

Paystack needs to tell Aziiki when a payment actually succeeds — that's
what confirms an invoice as paid, or upgrades someone's plan.

1. Still in **Settings → API Keys & Webhooks**, find the **Webhook URL**
   field.
2. Set it to: `https://YOUR-DEPLOYED-DOMAIN.com/api/payments/paystack/webhook`
   (replace with wherever Aziiki is actually hosted — the same domain you'd
   put in the desktop app's Settings screen, if you're using that too).
3. Save. Paystack will send a test ping — Aziiki's webhook handler already
   verifies Paystack's signature on every event (`verifyWebhookSignature`
   in `src/server/payments/paystackClient.ts`), so nothing further to
   configure here.

That's it for invoice payments — a customer paying an invoice through the
"Request Payment" link now gets tracked automatically.

## Step 3: Set up plan pricing (for the Basic → Standard/Pro upgrade path)

This part happens entirely in Aziiki's own **admin portal**, not
Paystack's dashboard directly — you just need one thing from Paystack
first.

1. In Paystack, go to **Payments → Payment Pages** and create one Payment
   Page per plan you want to sell (e.g. "Aziiki Standard - GHS", "Aziiki
   Pro - GHS"). Set the price on the page to exactly what you want to
   charge.
2. Copy that Payment Page's link (looks like `https://paystack.com/pay/your-page-slug`).
3. In Aziiki, go to **Admin Portal → Payments**, find the matching tier
   card, and paste in:
   - The Payment Page link
   - The exact price, in the currency's smallest unit (e.g. GHS 50 = `5000`
     pesewas, NGN 10,000 = `1000000` kobo) — this exact number is what the
     webhook matches an incoming payment against, so it must match the
     Payment Page's real price precisely.
   - The currency code (e.g. `GHS`, `NGN`).
4. Repeat for every currency/tier combination you want to offer — Aziiki
   already supports multiple currency rows per tier (a GHS price and an
   NGN price for Standard, for example).

**How the match actually works:** when someone pays through one of these
links, Paystack sends a webhook event with the amount, currency, and the
payer's email. Aziiki looks for a `subscription_plans` row with that exact
amount+currency, finds the account with that email, and upgrades it —
never downgrades, only ever moves a plan up. See
`src/server/routes/paymentsWebhook.ts` if you want the exact logic.

## Testing before you go live

Use your **Test** secret key and a Payment Page also set to test mode
(Paystack's dashboard has a toggle for this), then use one of
[Paystack's test card numbers](https://paystack.com/docs/payments/test-payments/)
to actually pay it — no real money moves, but the whole flow (webhook,
signature check, plan upgrade) runs for real. Once that works, swap to
your Live secret key and real Payment Page links.

## What's already built, so you don't need to ask for it again

- Invoice payment collection, with its own rate limit so it can't be
  abused as a free API proxy (`paystackInitializeLimiter`)
- Webhook signature verification (rejects anything not actually from
  Paystack)
- Idempotency — Paystack can and does resend the same webhook event;
  Aziiki only processes each payment reference once
- Never auto-downgrades a plan, even if a webhook amount happens to match
  a lower tier than someone already has
- Multi-currency pricing per tier (not just one price for the whole world)
