import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createClient } from "@supabase/supabase-js";

// Paystack itself is mocked (there's no real secret key in this environment,
// and constructing a real HMAC signature would need one) - everything else
// runs for real: the real app, the real database, real RLS. Same pattern
// e2e-feature-pricing.test.ts uses.
const paystack = vi.hoisted(() => ({ configured: true, signatureValid: true }));
vi.mock("./payments/paystackClient", () => ({
  isPaystackConfigured: () => paystack.configured,
  verifyWebhookSignature: () => paystack.signatureValid,
}));

import { createApp } from "./app";
import { getServiceRoleClient } from "./supabaseClients";
import { env } from "./env";

const app = createApp();
const stamp = Date.now();
const PASSWORD = "TestPass123!lifecycle";
const subscriber = { email: `lifecycle-sub-${stamp}@example.com`, id: "", token: "" };
const auth = (u: typeof subscriber) => ({ Authorization: `Bearer ${u.token}` });

// A deterministic test price on the 'standard' tier, overwriting whatever
// real price is configured for the run and restored afterward - so this
// test never depends on (or risks corrupting) the actual GHS 29/49 pricing
// an admin has live-configured.
const TEST_PRICE_MINOR = 191919;
const TEST_CURRENCY = "GHS";
let originalStandardPlan: any = null;

const send = (body: object) => request(app).post("/api/payments/paystack/webhook").set("x-paystack-signature", "test").send(body);
const currentTier = async () => {
  const { data } = await getServiceRoleClient().from("profiles").select("tier").eq("id", subscriber.id).single();
  return data?.tier;
};

beforeAll(async () => {
  const adminClient = getServiceRoleClient();
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { data, error } = await adminClient.auth.admin.createUser({ email: subscriber.email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  subscriber.id = data.user.id;
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email: subscriber.email, password: PASSWORD });
  if (e2) throw e2;
  subscriber.token = s.session!.access_token;

  const { data: existing } = await adminClient.from("subscription_plans").select("*").eq("tier", "standard").eq("currency", TEST_CURRENCY).maybeSingle();
  originalStandardPlan = existing;
  await adminClient
    .from("subscription_plans")
    .upsert({ tier: "standard", currency: TEST_CURRENCY, price_minor_units: TEST_PRICE_MINOR, provider: "paystack" }, { onConflict: "tier,currency" });
}, 30_000);

afterAll(async () => {
  const adminClient = getServiceRoleClient();
  if (originalStandardPlan) {
    await adminClient.from("subscription_plans").update(originalStandardPlan).eq("tier", "standard").eq("currency", TEST_CURRENCY);
  } else {
    await adminClient.from("subscription_plans").delete().eq("tier", "standard").eq("currency", TEST_CURRENCY);
  }
  await adminClient.from("subscription_cancellation_events").delete().like("subscription_code", `sub-lifecycle-${stamp}%`);
  await adminClient.from("subscription_payment_events").delete().like("paystack_reference", `lifecycle-pay-${stamp}%`);
  await adminClient.auth.admin.deleteUser(subscriber.id);
});

describe("subscription lifecycle: upgrade on charge.success, downgrade on subscription.disable", () => {
  it("upgrades to standard on a matching charge, then downgrades back to basic when the subscription is disabled", async () => {
    expect(await currentTier()).toBe("basic");

    const upgrade = await send({
      event: "charge.success",
      data: { reference: `lifecycle-pay-${stamp}-1`, amount: TEST_PRICE_MINOR, currency: TEST_CURRENCY, customer: { email: subscriber.email } },
    });
    expect(upgrade.status).toBe(200);
    expect(await currentTier()).toBe("standard");

    const cancel = await send({
      event: "subscription.disable",
      data: { subscription_code: `sub-lifecycle-${stamp}-1`, amount: TEST_PRICE_MINOR, currency: TEST_CURRENCY, customer: { email: subscriber.email } },
    });
    expect(cancel.status).toBe(200);
    expect(await currentTier()).toBe("basic");

    const { data: event } = await getServiceRoleClient()
      .from("subscription_cancellation_events")
      .select("*")
      .eq("subscription_code", `sub-lifecycle-${stamp}-1`)
      .single();
    expect(event.matched_tier).toBe("standard");
    expect(event.matched_user_id).toBe(subscriber.id);
  });

  it("is idempotent - the same subscription.disable event resent doesn't error or double-process", async () => {
    const body = {
      event: "subscription.disable",
      data: { subscription_code: `sub-lifecycle-${stamp}-1`, amount: TEST_PRICE_MINOR, currency: TEST_CURRENCY, customer: { email: subscriber.email } },
    };
    const res = await send(body);
    expect(res.status).toBe(200);
    const { data: events } = await getServiceRoleClient().from("subscription_cancellation_events").select("id").eq("subscription_code", `sub-lifecycle-${stamp}-1`);
    expect(events).toHaveLength(1);
  });

  it("does not downgrade if the account has since moved to a different tier than the one that was cancelled", async () => {
    await send({
      event: "charge.success",
      data: { reference: `lifecycle-pay-${stamp}-2`, amount: TEST_PRICE_MINOR, currency: TEST_CURRENCY, customer: { email: subscriber.email } },
    });
    expect(await currentTier()).toBe("standard");

    // Simulate the account having moved on (e.g. a superadmin manually
    // granted Pro) before this stale cancellation event arrives.
    await getServiceRoleClient().from("profiles").update({ tier: "pro" }).eq("id", subscriber.id);

    const cancel = await send({
      event: "subscription.disable",
      data: { subscription_code: `sub-lifecycle-${stamp}-2`, amount: TEST_PRICE_MINOR, currency: TEST_CURRENCY, customer: { email: subscriber.email } },
    });
    expect(cancel.status).toBe(200);
    expect(await currentTier()).toBe("pro");
  });

  it("does nothing when the cancelled amount doesn't match any configured plan", async () => {
    const res = await send({
      event: "subscription.disable",
      data: { subscription_code: `sub-lifecycle-${stamp}-3`, amount: 777_777, currency: TEST_CURRENCY, customer: { email: subscriber.email } },
    });
    expect(res.status).toBe(200);
    const { data: event } = await getServiceRoleClient().from("subscription_cancellation_events").select("matched_tier").eq("subscription_code", `sub-lifecycle-${stamp}-3`).single();
    expect(event.matched_tier).toBeNull();
  });
});
