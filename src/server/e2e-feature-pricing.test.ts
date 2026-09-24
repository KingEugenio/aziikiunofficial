import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createClient } from "@supabase/supabase-js";

// Paystack itself is mocked (there's no real secret key in this environment,
// and constructing a real HMAC signature would need one) - everything else
// runs for real: the real app, the real database, real RLS. Same pattern
// e2e-live-investments.test.ts uses for the Gemini client.
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
const PASSWORD = "TestPass123!pricing";
const admin = { email: `pricing-admin-${stamp}@example.com`, id: "", token: "" };
const buyer = { email: `pricing-buyer-${stamp}@example.com`, id: "", token: "" };
const outsider = { email: `pricing-outsider-${stamp}@example.com`, id: "", token: "" };
const auth = (u: typeof admin) => ({ Authorization: `Bearer ${u.token}` });

// A real, already-seeded Phase 2 flag - safe to attach test pricing to and
// guaranteed to still exist when this runs (added this session, not
// something a future cleanup would remove).
const FLAG_KEY = "net_worth_investments";
const PRICE = 42.5; // major units, e.g. GHS 42.50
const PRICE_MINOR = 4250;
const CURRENCY = "GHS";

async function signUp(u: { email: string; id: string; token: string }, adminClient: any, anon: any) {
  const { data, error } = await adminClient.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  u.id = data.user.id;
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email: u.email, password: PASSWORD });
  if (e2) throw e2;
  u.token = s.session!.access_token;
}

beforeAll(async () => {
  const adminClient = getServiceRoleClient();
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  await Promise.all([signUp(admin, adminClient, anon), signUp(buyer, adminClient, anon), signUp(outsider, adminClient, anon)]);
  await adminClient.from("profiles").update({ is_admin: true, is_superadmin: true }).eq("id", admin.id);
  // Start clean in case a previous run left pricing on this flag.
  await adminClient.from("feature_pricing").delete().eq("flag_key", FLAG_KEY);
}, 30_000);

afterAll(async () => {
  const adminClient = getServiceRoleClient();
  await adminClient.from("feature_pricing").delete().eq("flag_key", FLAG_KEY);
  await adminClient.from("user_feature_overrides").delete().in("user_id", [buyer.id, outsider.id]).eq("flag_key", FLAG_KEY);
  for (const u of [admin, buyer, outsider]) await adminClient.auth.admin.deleteUser(u.id);
});

describe("Admin permissions", () => {
  it("rejects a signed-in non-admin", async () => {
    const res = await request(app).get("/api/admin/feature-pricing").set(auth(buyer));
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request", async () => {
    const res = await request(app).get("/api/admin/feature-pricing");
    expect(res.status).toBe(401);
  });
});

describe("Admin feature-pricing CRUD", () => {
  it("lists every feature flag, the priced one starting out free", async () => {
    const res = await request(app).get("/api/admin/feature-pricing").set(auth(admin));
    expect(res.status).toBe(200);
    const row = res.body.data.find((r: any) => r.flagKey === FLAG_KEY);
    expect(row).toBeDefined();
    expect(row.isPaid).toBe(false);
    expect(row.name).toBeTruthy();
  });

  it("rejects an invalid body (paid with no price)", async () => {
    const res = await request(app)
      .put(`/api/admin/feature-pricing/${FLAG_KEY}`)
      .set(auth(admin))
      .send({ isPaid: true, price: null, currency: null, billingType: "one_time", provider: "paystack" });
    expect(res.status).toBe(400);
  });

  it("rejects pricing an unknown feature flag", async () => {
    const res = await request(app)
      .put("/api/admin/feature-pricing/not_a_real_flag")
      .set(auth(admin))
      .send({ isPaid: true, price: 10, currency: "GHS", billingType: "one_time", provider: "paystack" });
    expect(res.status).toBe(404);
  });

  it("marks the feature paid, with a price, currency and payment link", async () => {
    const res = await request(app)
      .put(`/api/admin/feature-pricing/${FLAG_KEY}`)
      .set(auth(admin))
      .send({
        isPaid: true,
        price: PRICE,
        currency: CURRENCY,
        billingType: "one_time",
        provider: "paystack",
        paymentLink: "https://paystack.com/pay/net-worth-test",
        accessMessage: "Unlocks live investment tracking.",
      });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ flagKey: FLAG_KEY, isPaid: true, price: PRICE, currency: CURRENCY, billingType: "one_time" });
  });

  it("a non-admin still can't write, even once pricing exists", async () => {
    const res = await request(app)
      .put(`/api/admin/feature-pricing/${FLAG_KEY}`)
      .set(auth(buyer))
      .send({ isPaid: true, price: 1, currency: "GHS", billingType: "one_time", provider: "paystack" });
    expect(res.status).toBe(403);
  });
});

describe("Public pricing endpoint - what users actually see", () => {
  it("lists the now-priced feature, without needing to be signed in", async () => {
    const res = await request(app).get("/api/config/feature-pricing");
    expect(res.status).toBe(200);
    const row = res.body.data.find((r: any) => r.flagKey === FLAG_KEY);
    expect(row).toMatchObject({ price: PRICE, currency: CURRENCY, billingType: "one_time", accessMessage: "Unlocks live investment tracking." });
  });

  it("never lists a feature that hasn't been marked paid", async () => {
    const res = await request(app).get("/api/config/feature-pricing");
    expect(res.body.data.some((r: any) => r.flagKey === "core_dashboard")).toBe(false);
  });
});

describe("Manual access grant", () => {
  it("rejects granting access to someone with no account", async () => {
    const res = await request(app)
      .put(`/api/admin/feature-pricing/${FLAG_KEY}/access`)
      .set(auth(admin))
      .send({ email: "nobody-real@example.com", enabled: true });
    expect(res.status).toBe(404);
  });

  it("grants a real user access, reflected immediately in their own /api/config/features", async () => {
    const grantRes = await request(app).put(`/api/admin/feature-pricing/${FLAG_KEY}/access`).set(auth(admin)).send({ email: outsider.email, enabled: true });
    expect(grantRes.status).toBe(200);

    const configRes = await request(app).get("/api/config/features").set(auth(outsider));
    expect(configRes.body.flags[FLAG_KEY]).toBe(true);
  });
});

describe("Paystack webhook - buying a single feature (not a whole tier)", () => {
  const send = (body: object) => request(app).post("/api/payments/paystack/webhook").set("x-paystack-signature", "test").send(body);

  it("grants the buyer access on a matching successful charge", async () => {
    expect((await request(app).get("/api/config/features").set(auth(buyer))).body.flags[FLAG_KEY]).not.toBe(true);

    const res = await send({
      event: "charge.success",
      data: { reference: `feature-pay-${stamp}-1`, amount: PRICE_MINOR, currency: CURRENCY, customer: { email: buyer.email } },
    });
    expect(res.status).toBe(200);

    const configRes = await request(app).get("/api/config/features").set(auth(buyer));
    expect(configRes.body.flags[FLAG_KEY]).toBe(true);

    const { data: events } = await getServiceRoleClient().from("feature_payment_events").select("*").eq("paystack_reference", `feature-pay-${stamp}-1`).single();
    expect(events.matched_flag_key).toBe(FLAG_KEY);
    expect(events.matched_user_id).toBe(buyer.id);
  });

  it("is idempotent - Paystack resending the same event doesn't error or double-process", async () => {
    const body = {
      event: "charge.success",
      data: { reference: `feature-pay-${stamp}-1`, amount: PRICE_MINOR, currency: CURRENCY, customer: { email: buyer.email } },
    };
    const res = await send(body);
    expect(res.status).toBe(200);
    const { data: events } = await getServiceRoleClient().from("feature_payment_events").select("id").eq("paystack_reference", `feature-pay-${stamp}-1`);
    expect(events).toHaveLength(1);
  });

  it("does not grant access when the amount doesn't match any priced feature", async () => {
    const res = await send({
      event: "charge.success",
      data: { reference: `feature-pay-${stamp}-2`, amount: 999_999, currency: CURRENCY, customer: { email: buyer.email } },
    });
    expect(res.status).toBe(200);
    const { data: eventRow } = await getServiceRoleClient().from("feature_payment_events").select("matched_flag_key").eq("paystack_reference", `feature-pay-${stamp}-2`).single();
    expect(eventRow.matched_flag_key).toBeNull();
  });

  it("refuses an unsigned/invalid webhook", async () => {
    paystack.signatureValid = false;
    const res = await send({ event: "charge.success", data: { reference: "bad-sig", amount: PRICE_MINOR, currency: CURRENCY, customer: { email: buyer.email } } });
    expect(res.status).toBe(401);
    paystack.signatureValid = true;
  });
});
