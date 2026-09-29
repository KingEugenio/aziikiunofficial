import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createClient } from "@supabase/supabase-js";
import { createApp } from "./app";
import { getServiceRoleClient } from "./supabaseClients";
import { env } from "./env";

// End-to-end through the real app and real database: a Point of Sale
// checkout rings up real inventory by id/quantity, decrements stock
// exactly (not the fuzzy name matching invoices.ts uses), and creates one
// itemized receipt with a companion ledger transaction.
const app = createApp();
const stamp = Date.now();
const PASSWORD = "TestPass123!pos";
const user = { email: `pos-${stamp}@example.com`, id: "", token: "" };
const outsider = { email: `pos-outsider-${stamp}@example.com`, id: "", token: "" };
const auth = (u = user) => ({ Authorization: `Bearer ${u.token}` });

let businessId: string;
let widgetId: string;
let gadgetId: string;

const signUp = async (u: typeof user, admin: any, anon: any) => {
  const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  u.id = data.user.id;
  const { data: s, error: e2 } = await anon.auth.signInWithPassword({ email: u.email, password: PASSWORD });
  if (e2) throw e2;
  u.token = s.session!.access_token;
};

const addInventory = async (name: string, sku: string, quantity: number, unitPrice: number) => {
  const res = await request(app).post("/api/inventory").set(auth()).send({
    businessId, name, sku, quantity, minStockAlert: 2, unitCost: unitPrice / 2, unitPrice,
  });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
};

beforeAll(async () => {
  const admin = getServiceRoleClient();
  const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  await signUp(user, admin, anon);
  await signUp(outsider, admin, anon);

  const biz = await request(app).post("/api/businesses").set(auth()).send({ name: "POS Test Biz", currency: "GHS", businessType: "Sole Proprietor" });
  businessId = biz.body.data.id;

  widgetId = await addInventory("Widget", `WID-${stamp}`, 10, 25);
  gadgetId = await addInventory("Gadget", `GAD-${stamp}`, 3, 100);
}, 30_000);

afterAll(async () => {
  const admin = getServiceRoleClient();
  await admin.auth.admin.deleteUser(user.id);
  await admin.auth.admin.deleteUser(outsider.id);
});

describe("POST /api/receipts/pos-sale", () => {
  it("rings up multiple items as one itemized receipt with a matching ledger transaction", async () => {
    const res = await request(app)
      .post("/api/receipts/pos-sale")
      .set(auth())
      .send({
        businessId,
        customClientName: "Walk-in",
        date: "2026-09-29",
        paymentMethod: "Cash",
        items: [
          { inventoryId: widgetId, quantity: 2 },
          { inventoryId: gadgetId, quantity: 1 },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.amountPaid).toBe(2 * 25 + 1 * 100);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.items.find((i: any) => i.inventoryId === widgetId).rate).toBe(25);

    const admin = getServiceRoleClient();
    const { data: items } = await admin.from("receipt_items").select("*").eq("receipt_id", res.body.data.id);
    expect(items).toHaveLength(2);
    expect(items!.find((i: any) => i.inventory_id === widgetId).sku).toBe(`WID-${stamp}`);

    const { data: widgetStock } = await admin.from("inventory").select("quantity").eq("id", widgetId).single();
    expect(Number(widgetStock?.quantity)).toBe(8); // 10 - 2

    const { data: receiptRow } = await admin.from("receipts").select("transaction_id").eq("id", res.body.data.id).single();
    expect(receiptRow?.transaction_id).toBeTruthy();
    const { data: tx } = await admin.from("transactions").select("amount").eq("id", receiptRow!.transaction_id).single();
    expect(Number(tx?.amount)).toBe(2 * 25 + 1 * 100);
  });

  it("clamps at zero instead of going negative when selling more than is in stock", async () => {
    const lowStockId = await addInventory("Scarce Item", `SCR-${stamp}`, 1, 10);
    const res = await request(app)
      .post("/api/receipts/pos-sale")
      .set(auth())
      .send({ businessId, date: "2026-09-29", paymentMethod: "Cash", items: [{ inventoryId: lowStockId, quantity: 5 }] });
    expect(res.status).toBe(201);

    const { data } = await getServiceRoleClient().from("inventory").select("quantity").eq("id", lowStockId).single();
    expect(Number(data?.quantity)).toBe(0);
  });

  it("rejects an inventory id that doesn't belong to this business", async () => {
    // A second business on the SAME account would hit the (unrelated)
    // multi-business tier limit - creating it on the outsider's account
    // instead still gives a real businessId that widgetId doesn't belong
    // to, without tripping that limit.
    const otherBiz = await request(app).post("/api/businesses").set(auth(outsider)).send({ name: "Other Biz", currency: "GHS", businessType: "Sole Proprietor" });
    const otherBusinessId = otherBiz.body.data.id;

    const res = await request(app)
      .post("/api/receipts/pos-sale")
      .set(auth())
      .send({ businessId: otherBusinessId, date: "2026-09-29", paymentMethod: "Cash", items: [{ inventoryId: widgetId, quantity: 1 }] });
    expect(res.status).toBe(400);
  });

  it("is invisible to another account entirely (RLS)", async () => {
    const res = await request(app)
      .post("/api/receipts/pos-sale")
      .set(auth(outsider))
      .send({ businessId, date: "2026-09-29", paymentMethod: "Cash", items: [{ inventoryId: widgetId, quantity: 1 }] });
    // The outsider doesn't own this business's inventory rows, so RLS
    // hides them - same "not found" the wrong-business test above hits.
    expect(res.status).toBe(400);
  });
});

describe("receipt_items database-level enforcement (bypassing the API)", () => {
  const asUser = () => createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${user.token}` } } });

  it("refuses a direct delete of a sold line item with no logged reason", async () => {
    const sale = await request(app)
      .post("/api/receipts/pos-sale")
      .set(auth())
      .send({ businessId, date: "2026-09-29", paymentMethod: "Cash", items: [{ inventoryId: widgetId, quantity: 1 }] });
    const { data: items } = await getServiceRoleClient().from("receipt_items").select("id").eq("receipt_id", sale.body.data.id);

    const { error } = await asUser().from("receipt_items").delete().eq("id", items![0].id);
    expect(error).not.toBeNull();
  });

  it("cascades cleanly when the whole receipt is deleted with a reason, through the normal amendment API", async () => {
    const sale = await request(app)
      .post("/api/receipts/pos-sale")
      .set(auth())
      .send({ businessId, date: "2026-09-29", paymentMethod: "Cash", items: [{ inventoryId: widgetId, quantity: 1 }] });

    const del = await request(app).delete(`/api/receipts/${sale.body.data.id}`).set(auth()).send({ changeReason: "Rung up by mistake, wrong item" });
    expect(del.status).toBe(204);

    const { data: items } = await getServiceRoleClient().from("receipt_items").select("id").eq("receipt_id", sale.body.data.id);
    expect(items).toEqual([]);
  });
});
