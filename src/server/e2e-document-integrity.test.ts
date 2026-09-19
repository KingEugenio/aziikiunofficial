import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createClient } from "@supabase/supabase-js";
import { createApp } from "./app";
import { getServiceRoleClient } from "./supabaseClients";
import { env } from "./env";

// End-to-end through the real app and real database: saved invoices/receipts
// are locked, changes need a written reason, and every change lands in an
// append-only history. Two throwaway accounts (the second proves isolation).
const app = createApp();
const stamp = Date.now();
const PASSWORD = "TestPass123!integrity";
const users = [
  { email: `integrity-a-${stamp}@example.com`, id: "", token: "" },
  { email: `integrity-b-${stamp}@example.com`, id: "", token: "" },
];
let businessId: string;
let customerId: string;
const GOOD_REASON = "Customer requested a corrected quantity";
const auth = (i = 0) => ({ Authorization: `Bearer ${users[i].token}` });

const item = (quantity: number) => [{ description: "Consulting", quantity, rate: 100 }];
const newInvoice = async (status: "Draft" | "Sent") => {
  const res = await request(app).post("/api/invoices").set(auth()).send({
    businessId, customerId, date: "2026-09-19", dueDate: "2026-10-19", items: item(1), status,
  });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; invoiceNumber: string };
};
const newReceipt = async () => {
  const res = await request(app).post("/api/receipts").set(auth()).send({
    businessId, customerId, date: "2026-09-19", description: "Deposit", amountPaid: 100, paymentMethod: "Cash",
  });
  expect(res.status).toBe(201);
  return res.body.data as { id: string; receiptNumber: string };
};
const history = async (documentId: string, i = 0) =>
  (await request(app).get(`/api/document-change-log?businessId=${businessId}&documentId=${documentId}`).set(auth(i))).body.data as any[];

beforeAll(async () => {
  const admin = getServiceRoleClient();
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  for (const u of users) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    u.id = data.user.id;
    const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email: u.email, password: PASSWORD });
    if (e2) throw e2;
    u.token = s.session!.access_token;
  }
  const biz = await request(app).post("/api/businesses").set(auth()).send({ name: "Integrity Test Biz", currency: "GHS", businessType: "Sole Proprietor" });
  businessId = biz.body.data.id;
  const cust = await request(app).post("/api/customers").set(auth()).send({ businessId, name: "Integrity Customer" });
  customerId = cust.body.data.id;
}, 30_000);

afterAll(async () => {
  for (const u of users) await getServiceRoleClient().auth.admin.deleteUser(u.id);
});

describe("invoices", () => {
  it("leaves a Draft freely editable and deletable, with no reason", async () => {
    const inv = await newInvoice("Draft");
    const edit = await request(app).patch(`/api/invoices/${inv.id}`).set(auth()).send({ discount: 10 });
    expect(edit.status).toBe(200);
    const del = await request(app).delete(`/api/invoices/${inv.id}`).set(auth());
    expect(del.status).toBe(204);
  });

  it("refuses to change a saved invoice without a reason (428), and a too-short reason is not a reason", async () => {
    const inv = await newInvoice("Sent");
    const none = await request(app).patch(`/api/invoices/${inv.id}`).set(auth()).send({ items: item(5) });
    expect(none.status).toBe(428);
    expect(none.body.code).toBe("REASON_REQUIRED");
    const short = await request(app).patch(`/api/invoices/${inv.id}`).set(auth()).send({ items: item(5), changeReason: "oops" });
    expect(short.status).toBe(428);
    // Nothing changed.
    const list = await request(app).get(`/api/invoices?businessId=${businessId}`).set(auth());
    expect(list.body.data.find((i: any) => i.id === inv.id).items[0].quantity).toBe(1);
  });

  it("applies a reasoned amendment and records exactly what changed and why", async () => {
    const inv = await newInvoice("Sent");
    const res = await request(app).patch(`/api/invoices/${inv.id}`).set(auth()).send({ items: item(3), discount: 5, changeReason: GOOD_REASON });
    expect(res.status).toBe(200);
    expect(res.body.data.items[0].quantity).toBe(3);

    const [entry] = await history(inv.id);
    expect(entry.action).toBe("amended");
    expect(entry.reason).toBe(GOOD_REASON);
    expect(entry.changedByMe).toBe(true);
    expect(entry.documentNumber).toBe(inv.invoiceNumber);
    expect(entry.changes.discount).toEqual({ from: 0, to: 5 });
    expect(entry.changes.items.from[0].quantity).toBe(1);
    expect(entry.changes.items.to[0].quantity).toBe(3);
  });

  it("lets a saved invoice move Sent -> Paid without a reason (and logs it), but not backwards", async () => {
    const inv = await newInvoice("Sent");
    const paid = await request(app).patch(`/api/invoices/${inv.id}`).set(auth()).send({ status: "Paid" });
    expect(paid.status).toBe(200);
    expect((await history(inv.id))[0].action).toBe("status_changed");

    const back = await request(app).patch(`/api/invoices/${inv.id}`).set(auth()).send({ status: "Sent" });
    expect(back.status).toBe(428);
    const unlock = await request(app).patch(`/api/invoices/${inv.id}`).set(auth()).send({ status: "Draft" });
    expect(unlock.status).toBe(428);
  });

  it("never lets a saved invoice's number change, even with a good reason", async () => {
    const inv = await newInvoice("Sent");
    const res = await request(app).patch(`/api/invoices/${inv.id}`).set(auth()).send({ invoiceNumber: "INV-9999", changeReason: GOOD_REASON });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NUMBER_LOCKED");
  });

  it("needs a reason to delete a saved invoice, and the history outlives it with a full snapshot", async () => {
    const inv = await newInvoice("Sent");
    const no = await request(app).delete(`/api/invoices/${inv.id}`).set(auth());
    expect(no.status).toBe(428);

    const yes = await request(app).delete(`/api/invoices/${inv.id}`).set(auth()).send({ changeReason: "Issued to the wrong customer" });
    expect(yes.status).toBe(204);

    const list = await request(app).get(`/api/invoices?businessId=${businessId}`).set(auth());
    expect(list.body.data.find((i: any) => i.id === inv.id)).toBeUndefined();

    const [entry] = await history(inv.id);
    expect(entry.action).toBe("deleted");
    expect(entry.reason).toBe("Issued to the wrong customer");
    expect(entry.changes.snapshot.invoiceNumber).toBe(inv.invoiceNumber);
    expect(entry.changes.snapshot.items[0].description).toBe("Consulting");
  });
});

describe("receipts", () => {
  it("are locked from creation: every change and delete needs a reason", async () => {
    const rec = await newReceipt();
    const none = await request(app).patch(`/api/receipts/${rec.id}`).set(auth()).send({ amountPaid: 500 });
    expect(none.status).toBe(428);
    const ok = await request(app).patch(`/api/receipts/${rec.id}`).set(auth()).send({ amountPaid: 500, changeReason: "Customer paid the full amount, not a deposit" });
    expect(ok.status).toBe(200);
    expect(ok.body.data.amountPaid).toBe(500);
    expect((await history(rec.id))[0].changes.amountPaid).toEqual({ from: 100, to: 500 });

    const numberChange = await request(app).patch(`/api/receipts/${rec.id}`).set(auth()).send({ receiptNumber: "REC-9999", changeReason: GOOD_REASON });
    expect(numberChange.status).toBe(403);

    expect((await request(app).delete(`/api/receipts/${rec.id}`).set(auth())).status).toBe(428);
    const del = await request(app).delete(`/api/receipts/${rec.id}`).set(auth()).send({ changeReason: "Duplicate of another receipt" });
    expect(del.status).toBe(204);
    expect((await history(rec.id))[0].action).toBe("deleted");
  });
});

describe("the history itself", () => {
  it("is private to the business: another account sees nothing", async () => {
    const inv = await newInvoice("Sent");
    await request(app).patch(`/api/invoices/${inv.id}`).set(auth()).send({ discount: 20, changeReason: GOOD_REASON });
    expect((await history(inv.id, 0)).length).toBeGreaterThan(0);
    expect(await history(inv.id, 1)).toEqual([]);
  });

  it("can't be edited or deleted, even by the person who made the change", async () => {
    const inv = await newInvoice("Sent");
    await request(app).patch(`/api/invoices/${inv.id}`).set(auth()).send({ discount: 30, changeReason: GOOD_REASON });
    const [entry] = await history(inv.id);

    // Straight to the database with the user's own login token - no API in between.
    const asUser = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${users[0].token}` } } });
    await asUser.from("document_change_log").update({ reason: "Nothing to see here, honest" }).eq("id", entry.id);
    await asUser.from("document_change_log").delete().eq("id", entry.id);

    const { data } = await getServiceRoleClient().from("document_change_log").select("reason").eq("id", entry.id).single();
    expect(data?.reason).toBe(GOOD_REASON);
  });

  it("rejects a change-log write that claims an amendment without a real reason", async () => {
    const inv = await newInvoice("Sent");
    const { error } = await getServiceRoleClient().from("document_change_log").insert({
      business_id: businessId, user_id: users[0].id, document_type: "invoice", document_id: inv.id, action: "amended", reason: "short",
    });
    expect(error).not.toBeNull();
  });
});
