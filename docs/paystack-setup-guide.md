# Setting Up Paystack for Aziiki

Paystack already works end-to-end in this codebase — nothing new needs to
be built. This guide is just "where do I get the values, and where do I
put them."

Aziiki never collects payment on a business's behalf — it's a
records/reminders tool (track who owes you, nudge them), not a payment
collector. The only money that ever flows through Paystack here is a
business paying **its own Aziiki subscription** (Basic → Standard/Pro),
which is Aziiki collecting its own fee, not standing between a business
and its customers' money.

---

## Step 1: Get your Paystack Secret Key

1. Sign in at [dashboard.paystack.com](https://dashboard.paystack.com) (or
   create an account if you don't have one — it's free to sign up, Paystack
   only takes a percentage per real transaction).
2. Go to **Settings → API Keys & Webhooks**.
3. Copy your **Secret Key**. Paystack gives you a **Test** key and a
   **Live** key — use the Test key first while you're trying everything
   out (it won't move real money), then switch to the Live key when you're
   ready for real subscribers.

**Where it goes:**

- Local development: paste it into `.env` as `PAYSTACK_SECRET_KEY=sk_test_...`
- Production (Vercel): **Project → Settings → Environment Variables**, same
  variable name, same value (use your Live key here once you're ready).

### Which key is which

| Key | Looks like | What Aziiki does with it |
|---|---|---|
| Secret key | `sk_live_...` or `sk_test_...` | **Needed.** The server uses it to check that a payment notification really came from Paystack. |
| Public key | `pk_live_...` or `pk_test_...` | **Not used.** Aziiki sends people to your Payment Page, so it never needs this one. Nothing to enter. |

The secret key is a password to your Paystack account. Only ever put it in an
environment variable on the server (below). **Don't** paste it into chat, a
message, a document, the admin portal, or any file that goes to GitHub.

### Adding or changing your secret key (also how to swap in a new one)

Do these two things, every time the key changes. Both use the same variable
name, `PAYSTACK_SECRET_KEY`.

**On Vercel (your live site):**

1. Open your project in Vercel → **Settings → Environment Variables**.
2. If `PAYSTACK_SECRET_KEY` already exists, click it and choose **Edit**. If
   not, choose **Add New** and type that exact name.
3. Paste the new secret key as the value. Tick **Production** (and Preview if
   you want it there too). Save.
4. **Redeploy**: Deployments → the latest one → ⋯ → **Redeploy**. Vercel only
   picks up a changed variable on a new deployment, so this step matters.

**On your own computer (for local testing):** open the `.env` file in the
project folder and set `PAYSTACK_SECRET_KEY=sk_test_...` (use a *test* key
here). That file is already excluded from GitHub. Restart `npm run dev`.

**When you generate a new key in Paystack:** the old one stops working right
away, so update Vercel straight after and redeploy. Between generating and
redeploying, payment notifications will be rejected. Paystack retries them,
but do it promptly. If a key was ever pasted somewhere it shouldn't have been,
generate a new one in **Settings → API Keys & Webhooks** and replace it as
above.

**To check it worked:** in Paystack's webhook settings, send a test event
after the redeploy. A `200` reply means Aziiki accepted the signature.

## Step 2: Point Paystack's webhook at your app

Paystack needs to tell Aziiki when a subscription payment actually
succeeds — that's what upgrades someone's plan.

1. Still in **Settings → API Keys & Webhooks**, find the **Webhook URL**
   field.
2. Set it to: `https://YOUR-DEPLOYED-DOMAIN.com/api/payments/paystack/webhook` (for your live site: `https://aziikiunofficial.vercel.app/api/payments/paystack/webhook`)
   (replace with wherever Aziiki is actually hosted — the same domain you'd
   put in the desktop app's Settings screen, if you're using that too).
3. Save. Paystack will send a test ping — Aziiki's webhook handler already
   verifies Paystack's signature on every event (`verifyWebhookSignature`
   in `src/server/payments/paystackClient.ts`), so nothing further to
   configure here.

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

- Webhook signature verification (rejects anything not actually from
  Paystack)
- Idempotency — Paystack can and does resend the same webhook event;
  Aziiki only processes each payment reference once
- Never auto-downgrades a plan, even if a webhook amount happens to match
  a lower tier than someone already has
- Multi-currency pricing per tier (not just one price for the whole world)
