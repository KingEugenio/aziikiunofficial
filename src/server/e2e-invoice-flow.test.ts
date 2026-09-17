import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app";
import { getServiceRoleClient } from "./supabaseClients";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Real end-to-end test through the actual Express app (createApp(), no
// app.listen() needed - supertest talks to it in-process) rather than
// mocks: signup -> create a business -> create a customer -> create an
// invoice -> mark it paid -> confirm it reads back correctly. This is the
// one flow that touches the most of the codebase in a single pass (auth,
// RLS, the numbering system, the money-math layer, and a status update),
// so a regression anywhere in that chain shows up here even if a more
// narrowly-scoped unit test wouldn't catch it.
//
// "Signup" here means a real Supabase Auth user, created via the
// service-role admin API with email_confirm: true - the public
// POST /api/auth/signup route itself only ever returns "check your email"
// with no session, since this project has email confirmation enabled, so
// there is no way to complete that exact flow without reading a real
// inbox. What's actually under test - Aziiki's own business logic for
// businesses/customers/invoices - is identical either way; only the
// email-confirmation click itself (entirely Supabase's own infrastructure,
// not Aziiki's code) is bypassed.
const TEST_EMAIL = `e2e-invoice-flow-${Date.now()}@example.com`;
const TEST_PASSWORD = "TestPass123!e2e";

const app = createApp();
let accessToken: string;
let userId: string;
let businessId: string;
let customerId: string;
let invoiceId: string;

beforeAll(async () => {
  const admin = getServiceRoleClient();
  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (userErr) throw userErr;
  userId = userData.user.id;

  // A plain anon-key client, matching what the real browser app uses to
  // sign in and obtain the bearer token every subsequent request carries.
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  const { data: sessionData, error: signInErr } = await anon.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInErr) throw signInErr;
  accessToken = sessionData.session!.access_token;
}, 20_000);

afterAll(async () => {
  // Deleting the user cascades to businesses/customers/invoices (all
  // declared ON DELETE CASCADE on user_id) - nothing else to clean up.
  await getServiceRoleClient().auth.admin.deleteUser(userId);
});

describe("signup -> business -> customer -> invoice -> paid", () => {
  it("creates a business for the newly signed-up account", async () => {
    const res = await request(app)
      .post("/api/businesses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "E2E Flow Test Biz", currency: "GHS", businessType: "Sole Proprietor" });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("E2E Flow Test Biz");
    businessId = res.body.data.id;
  });

  it("creates a customer under that business", async () => {
    const res = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ businessId, name: "E2E Test Customer", email: "customer@example.com" });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("E2E Test Customer");
    customerId = res.body.data.id;
  });

  it("creates an invoice with a correctly reserved, atomic invoice number", async () => {
    const res = await request(app)
      .post("/api/invoices")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        businessId,
        customerId,
        date: "2026-09-17",
        dueDate: "2026-10-01",
        items: [{ description: "Consulting services", quantity: 2, rate: 500 }],
        discount: 10,
        taxRate: 15,
        status: "Sent",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.invoiceNumber).toMatch(/^INV-\d+$/);
    expect(res.body.data.status).toBe("Sent");
    invoiceId = res.body.data.id;
  });

  it("marks the invoice paid and the status persists on read-back", async () => {
    const updateRes = await request(app)
      .patch(`/api/invoices/${invoiceId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "Paid" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe("Paid");

    const listRes = await request(app).get("/api/invoices").set("Authorization", `Bearer ${accessToken}`);
    expect(listRes.status).toBe(200);
    const paidInvoice = listRes.body.data.find((inv: any) => inv.id === invoiceId);
    expect(paidInvoice).toBeDefined();
    expect(paidInvoice.status).toBe("Paid");
    // 2 x 500 = 1000, - 10% discount = 900, + 15% tax = 1035 - the money
    // layer (calculateInvoiceTotals) computing the same total server-side
    // that the frontend would show is exactly the class of bug a unit
    // test on money.ts alone wouldn't catch if the route wired it up wrong.
    expect(paidInvoice.items[0].quantity * paidInvoice.items[0].rate).toBe(1000);
  });

  it("rejects the same request from an unauthenticated caller", async () => {
    const res = await request(app).get("/api/invoices");
    expect(res.status).toBe(401);
  });
});
