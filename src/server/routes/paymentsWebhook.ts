import express, { Router, type Request, type Response } from "express";
import { verifyWebhookSignature, isPaystackConfigured } from "../payments/paystackClient";
import { getServiceRoleClient } from "../supabaseClients";

export const paymentsWebhookRouter = Router();

const TIER_RANK: Record<string, number> = { basic: 0, standard: 1, pro: 2 };

// Aziiki never collects payment on a business's behalf (see the removed
// "Request Payment" invoice-collection feature) - the only money that ever
// flows through this webhook is a business paying ITS OWN Aziiki
// subscription, via an admin-configured Paystack Payment Page (migration
// 0042). Those links carry no reference we created ourselves, so amount
// (+ currency) matching the email on the charge is the only correlation
// available without the admin wiring up custom metadata per plan.
async function handleSubscriptionPayment(supabase: ReturnType<typeof getServiceRoleClient>, reference: string, data: any): Promise<boolean> {
  // Idempotency: Paystack can resend the same event. Reports "not a tier
  // match" on a replay - harmless either way, since handleFeaturePayment
  // has this exact same idempotency check of its own.
  const { data: existing } = await supabase
    .from("subscription_payment_events")
    .select("id")
    .eq("paystack_reference", reference)
    .maybeSingle();
  if (existing) return false;

  const email: string | undefined = data?.customer?.email;
  const amount: number | undefined = data?.amount;
  const currency: string | undefined = data?.currency;

  let matchedTier: string | null = null;
  let matchedUserId: string | null = null;

  if (email && typeof amount === "number") {
    const { data: plans } = await supabase.from("subscription_plans").select("tier, price_minor_units, currency");
    const plan = (plans ?? []).find(
      (p) => p.price_minor_units === amount && (!currency || !p.currency || p.currency === currency)
    );

    if (plan) {
      const { data: profile } = await supabase.from("profiles").select("id, tier").eq("email", email.toLowerCase()).maybeSingle();
      if (profile) {
        matchedTier = plan.tier;
        matchedUserId = profile.id;
        const currentRank = TIER_RANK[profile.tier ?? "basic"] ?? 0;
        const newRank = TIER_RANK[plan.tier] ?? 0;
        // Never auto-downgrade - only apply if this payment's tier is a
        // step up from what they already have.
        if (newRank > currentRank) {
          // Account-level change, not tied to any one business - so this
          // doesn't go through createNotification (which requires a
          // business_id); the upgrade takes effect on the account's next
          // GET /api/config/features fetch instead.
          await supabase.from("profiles").update({ tier: plan.tier }).eq("id", profile.id);
        }
      }
    }
  }

  await supabase.from("subscription_payment_events").insert({
    paystack_reference: reference,
    email: email ?? null,
    amount_minor_units: amount ?? null,
    matched_tier: matchedTier,
    matched_user_id: matchedUserId,
    raw_event: data,
  });

  // Did this same payment ALSO happen to match a whole-tier plan above?
  // Both tables get an audit row regardless (so nothing a payment matched
  // ever goes unrecorded), but a single Payment Page link only ever
  // represents one real offer - if it already matched a tier, don't also
  // treat it as a feature purchase.
  return matchedTier !== null;
}

// A single feature's own price (migration 0067, /admin -> Payments ->
// Feature Pricing) - separate from a whole-tier plan. On a match, grants
// the feature the same way an admin manually granting access from the
// Feature Flags panel already does: a user_feature_overrides row. That is
// the ONLY access-control effect - everywhere else in the app already
// reads user_feature_overrides as the source of truth, so nothing else
// needs to know a payment was involved at all.
async function handleFeaturePayment(supabase: ReturnType<typeof getServiceRoleClient>, reference: string, data: any) {
  const { data: existing } = await supabase
    .from("feature_payment_events")
    .select("id")
    .eq("paystack_reference", reference)
    .maybeSingle();
  if (existing) return;

  const email: string | undefined = data?.customer?.email;
  const amount: number | undefined = data?.amount;
  const currency: string | undefined = data?.currency;

  let matchedFlagKey: string | null = null;
  let matchedUserId: string | null = null;

  if (email && typeof amount === "number") {
    const { data: pricedFeatures } = await supabase
      .from("feature_pricing")
      .select("flag_key, price_minor_units, currency")
      .eq("is_paid", true);
    const feature = (pricedFeatures ?? []).find(
      (f) => f.price_minor_units === amount && (!currency || !f.currency || f.currency === currency)
    );

    if (feature) {
      const { data: profile } = await supabase.from("profiles").select("id").eq("email", email.toLowerCase()).maybeSingle();
      if (profile) {
        matchedFlagKey = feature.flag_key;
        matchedUserId = profile.id;
        await supabase
          .from("user_feature_overrides")
          .upsert({ user_id: profile.id, flag_key: feature.flag_key, enabled: true }, { onConflict: "user_id,flag_key" });
      }
    }
  }

  await supabase.from("feature_payment_events").insert({
    paystack_reference: reference,
    email: email ?? null,
    amount_minor_units: amount ?? null,
    matched_flag_key: matchedFlagKey,
    matched_user_id: matchedUserId,
    raw_event: data,
  });
}

// Paystack sends this with no user session at all, so it cannot go through
// requireAuth - the raw HMAC signature below is the ONLY thing that
// authenticates a request as genuinely coming from Paystack. This router is
// mounted in server.ts BEFORE the global express.json() middleware because
// signature verification requires the exact raw request bytes; parsing JSON
// first would make that impossible to recompute correctly.
paymentsWebhookRouter.post("/", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
  if (!isPaystackConfigured()) {
    // No secret key configured means we can't verify anything - refuse
    // rather than trust an unverifiable payload.
    res.status(503).end();
    return;
  }

  const rawBody: Buffer = req.body;
  const signature = req.header("x-paystack-signature");

  if (!Buffer.isBuffer(rawBody) || !verifyWebhookSignature(rawBody, signature)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  // Only a successful subscription-upgrade payment needs any action here -
  // a failed charge attempt has nothing in Aziiki to update (no invoice
  // payment tracking exists anymore). Acknowledge everything else as a
  // silent 200 so Paystack doesn't keep retrying an event we were never
  // going to act on.
  const event = payload?.event;
  const data = payload?.data;
  const reference: string | undefined = data?.reference;

  if (reference && event === "charge.success") {
    const supabase = getServiceRoleClient();
    const matchedATier = await handleSubscriptionPayment(supabase, reference, data);
    if (!matchedATier) await handleFeaturePayment(supabase, reference, data);
  }

  res.status(200).json({ received: true });
});
