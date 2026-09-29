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

  it("keeps the companion ledger transaction in sync: created, amended, and removed with the receipt", async () => {
    const rec = await newReceipt();
    const admin = getServiceRoleClient();

    const { data: created } = await admin.from("receipts").select("transaction_id").eq("id", rec.id).single();
    expect(created?.transaction_id).toBeTruthy();
    const { data: createdTx } = await admin.from("transactions").select("amount").eq("id", created!.transaction_id).single();
    expect(Number(createdTx?.amount)).toBe(100);

    await request(app).patch(`/api/receipts/${rec.id}`).set(auth()).send({ amountPaid: 250, changeReason: "Customer paid the balance" });
    const { data: amendedTx } = await admin.from("transactions").select("amount").eq("id", created!.transaction_id).single();
    expect(Number(amendedTx?.amount)).toBe(250);

    await request(app).delete(`/api/receipts/${rec.id}`).set(auth()).send({ changeReason: "Duplicate of another receipt" });
    const { data: deletedTx } = await admin.from("transactions").select("id").eq("id", created!.transaction_id).maybeSingle();
    expect(deletedTx).toBeNull();
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

// The gap this closes: the rules above are all enforced by Express - someone
// with their own valid login token calling Supabase directly skips all of
// it. These go straight to the database, exactly like that, to prove the
// database itself now refuses what the API would have refused.
describe("database-level enforcement (bypassing the API entirely)", () => {
  const asUser = () => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${users[0].token}` } } });
  const logReason = (documentType: "invoice" | "receipt", documentId: string, action: "amended" | "deleted", reason = GOOD_REASON) =>
    getServiceRoleClient()
      .from("document_change_log")
      .insert({ business_id: businessId, user_id: users[0].id, document_type: documentType, document_id: documentId, action, reason });

  it("refuses a direct UPDATE to a locked invoice with no logged reason", async () => {
    const inv = await newInvoice("Sent");
    const { error } = await asUser().from("invoices").update({ discount: 999 }).eq("id", inv.id);
    expect(error).not.toBeNull();
  });

  it("refuses a direct DELETE of a locked invoice with no logged reason", async () => {
    const inv = await newInvoice("Sent");
    const { error } = await asUser().from("invoices").delete().eq("id", inv.id);
    expect(error).not.toBeNull();
  });

  it("still refuses to change a locked invoice's number, even with a genuinely logged reason", async () => {
    const inv = await newInvoice("Sent");
    await logReason("invoice", inv.id, "amended");
    const { error } = await asUser().from("invoices").update({ invoice_number: "INV-HACKED" }).eq("id", inv.id);
    expect(error).not.toBeNull();
  });

  it("allows a direct UPDATE once a genuine reason was actually logged first", async () => {
    const inv = await newInvoice("Sent");
    await logReason("invoice", inv.id, "amended");
    const { error } = await asUser().from("invoices").update({ discount: 42 }).eq("id", inv.id);
    expect(error).toBeNull();
    const { data } = await getServiceRoleClient().from("invoices").select("discount").eq("id", inv.id).single();
    expect(Number(data?.discount)).toBe(42);
  });

  it("still lets a locked invoice move Sent -> Paid directly, with no reason needed", async () => {
    const inv = await newInvoice("Sent");
    const { error } = await asUser().from("invoices").update({ status: "Paid" }).eq("id", inv.id);
    expect(error).toBeNull();
  });

  it("refuses a direct change to a locked invoice's line items with no logged reason", async () => {
    const inv = await newInvoice("Sent");
    const { data: item } = await getServiceRoleClient().from("invoice_items").select("id").eq("invoice_id", inv.id).single();
    const { error } = await asUser().from("invoice_items").update({ rate: 99999 }).eq("id", item!.id);
    expect(error).not.toBeNull();
  });

  it("allows a direct change to a locked invoice's line items once a genuine reason was logged", async () => {
    const inv = await newInvoice("Sent");
    await logReason("invoice", inv.id, "amended");
    const { data: item } = await getServiceRoleClient().from("invoice_items").select("id").eq("invoice_id", inv.id).single();
    const { error } = await asUser().from("invoice_items").update({ rate: 250 }).eq("id", item!.id);
    expect(error).toBeNull();
  });

  it("refuses a direct UPDATE or DELETE of a receipt with no logged reason", async () => {
    const rec = await newReceipt();
    const upd = await asUser().from("receipts").update({ amount_paid: 999 }).eq("id", rec.id);
    expect(upd.error).not.toBeNull();
    const del = await asUser().from("receipts").delete().eq("id", rec.id);
    expect(del.error).not.toBeNull();
  });

  it("allows a direct receipt UPDATE once a genuine reason was actually logged first", async () => {
    const rec = await newReceipt();
    await logReason("receipt", rec.id, "amended");
    const { error } = await asUser().from("receipts").update({ amount_paid: 321 }).eq("id", rec.id);
    expect(error).toBeNull();
  });
});

// Regression test: an earlier version of the lock-enforcement triggers
// above correctly refused an unlogged DELETE of a single document, but
// also wrongly refused when a whole business/account is deleted and its
// locked invoices/receipts cascade-delete along with it - breaking the
// real DELETE /api/auth/account feature ("deleting your account
// permanently removes it" per the Terms of Service) for any account with
// invoice/receipt history. This needs its own throwaway account, since it
// deletes it entirely.
describe("account deletion still works even with locked documents", () => {
  it("cascades cleanly through a locked invoice, its items, a receipt, and its items with no reason logged anywhere", async () => {
    const admin = getServiceRoleClient();
    const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
    const email = `integrity-delete-${stamp}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) throw error;
    const userId = data.user.id;
    const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email, password: PASSWORD });
    if (e2) throw e2;
    const token = s.session!.access_token;
    const authHeader = { Authorization: `Bearer ${token}` };

    const biz = await request(app).post("/api/businesses").set(authHeader).send({ name: "Delete Me Biz", currency: "GHS", businessType: "Sole Proprietor" });
    const bizId = biz.body.data.id;
    const cust = await request(app).post("/api/customers").set(authHeader).send({ businessId: bizId, name: "Delete Me Customer" });
    const custId = cust.body.data.id;

    // A Sent (locked) invoice and a receipt - both locked, neither ever
    // amended or deleted with a reason.
    const inv = await request(app).post("/api/invoices").set(authHeader).send({
      businessId: bizId, customerId: custId, date: "2026-09-19", dueDate: "2026-10-19", items: item(1), status: "Sent",
    });
    expect(inv.status).toBe(201);
    const rec = await request(app).post("/api/receipts").set(authHeader).send({
      businessId: bizId, customerId: custId, date: "2026-09-19", description: "Deposit", amountPaid: 100, paymentMethod: "Cash",
    });
    expect(rec.status).toBe(201);

    const del = await request(app).delete("/api/auth/account").set(authHeader);
    expect(del.status).toBe(204);

    const { data: leftoverInvoices } = await admin.from("invoices").select("id").eq("business_id", bizId);
    const { data: leftoverReceipts } = await admin.from("receipts").select("id").eq("business_id", bizId);
    expect(leftoverInvoices).toEqual([]);
    expect(leftoverReceipts).toEqual([]);
  });
});
