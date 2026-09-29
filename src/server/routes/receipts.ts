import type { Request, Response } from "express";
import { Router } from "express";
import { receiptSchema, receiptUpdateSchema, posSaleSchema } from "../validation/billing";
import { cached, invalidate } from "../redis";
import { isEmailConfigured, sendTransactionalEmail } from "../email/resendClient";
import { renderReceiptEmailHtml } from "../email/documentTemplates";
import { resolveBusinessCurrency } from "./crudFactory";
import { checkLowStockAndNotify } from "../notifications/lowStockCheck";
import {
  diffFields,
  logAmendmentFailed,
  logDocumentChange,
  parseReason,
  respondNumberLocked,
  respondReasonRequired,
} from "../documentIntegrity";

const LIST_CACHE_TTL_SECONDS = 45;

function fromRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id,
    customerId: row.customer_id ?? undefined,
    customClientName: row.custom_client_name ?? undefined,
    invoiceId: row.invoice_id ?? undefined,
    receiptNumber: row.receipt_number,
    date: row.date,
    description: row.description ?? "",
    amountPaid: Number(row.amount_paid),
    paymentMethod: row.payment_method,
    currency: row.currency,
    exchangeRateToBusinessCurrency: Number(row.exchange_rate_to_business_currency),
  };
}

export const receiptsRouter = Router();

receiptsRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;
  const cacheKey = `cache:receipts:${userId}`;

  const allRows = await cached(cacheKey, LIST_CACHE_TTL_SECONDS, async () => {
    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .order("created_at", { ascending: false })
      // See the matching comment in sync.ts - raised from 2000.
      .limit(50000);
    if (error) throw error;
    return data ?? [];
  });

  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  const rows = businessId ? allRows.filter((r: any) => r.business_id === businessId) : allRows;
  res.json({ data: rows.map(fromRow) });
});

// Creating a receipt also logs a matching income transaction, exactly like
// the original app's handleAddReceipt did client-side - just done atomically
// on the server now instead of via a debounced full-state re-save.
receiptsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = receiptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  let receiptNumber = input.receiptNumber;
  if (!receiptNumber) {
    const { data: reserved, error: numberError } = await supabase.rpc("next_document_number", {
      p_business_id: input.businessId,
      p_document_type: "receipt",
      p_default_prefix: "REC",
    });
    if (numberError) {
      res.status(400).json({ error: numberError.message });
      return;
    }
    receiptNumber = reserved as string;
  }

  const currency = input.currency ?? (await resolveBusinessCurrency(supabase, input.businessId));

  // Insert the companion transaction first (see documentIntegrity.ts - a
  // receipt is locked from the moment it exists, so the receipt's own
  // transaction_id must be set in its initial INSERT, never in a follow-up
  // UPDATE, which the receipts_enforce_lock trigger would correctly reject
  // as an unlogged amendment).
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      business_id: input.businessId,
      customer_id: input.customerId ?? null,
      date: input.date,
      type: "income",
      category: "Client Project",
      amount: input.amountPaid,
      description: input.description,
      payment_method: input.paymentMethod,
      currency,
      exchange_rate_to_business_currency: input.exchangeRateToBusinessCurrency,
    })
    .select("id")
    .single();

  if (txError) {
    console.error("[receipts] failed to log companion transaction:", txError.message);
  }

  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      user_id: userId,
      business_id: input.businessId,
      customer_id: input.customerId ?? null,
      custom_client_name: input.customClientName ?? null,
      invoice_id: input.invoiceId ?? null,
      receipt_number: receiptNumber,
      date: input.date,
      description: input.description,
      amount_paid: input.amountPaid,
      payment_method: input.paymentMethod,
      currency,
      exchange_rate_to_business_currency: input.exchangeRateToBusinessCurrency,
      transaction_id: transaction?.id ?? null,
    })
    .select("*")
    .single();

  if (receiptError) {
    // Compensating action: don't leave a phantom income entry behind with
    // no receipt to back it up.
    if (transaction?.id) await supabase.from("transactions").delete().eq("id", transaction.id);
    res.status(400).json({ error: receiptError.message });
    return;
  }

  await invalidate(`cache:receipts:${userId}`, `cache:transactions:${userId}`);
  res.status(201).json({ data: fromRow(receipt) });
});

// Point of Sale checkout (migration 0073, gated by the retail_pos feature
// flag/paywall client-side): rings up real inventory rows by id (never a
// client-supplied price or description - see posSaleSchema), as one
// itemized receipt with exact stock decrement per item, instead of the
// fuzzy description-vs-name matching runPaidWorkflow uses for invoices.
receiptsRouter.post("/pos-sale", async (req: Request, res: Response) => {
  const parsed = posSaleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const input = parsed.data;

  const inventoryIds = input.items.map((i) => i.inventoryId);
  const { data: stockRows, error: stockError } = await supabase
    .from("inventory")
    .select("*")
    .eq("business_id", input.businessId)
    .in("id", inventoryIds);
  if (stockError) {
    res.status(400).json({ error: stockError.message });
    return;
  }
  const stockById = new Map((stockRows ?? []).map((r: any) => [r.id, r]));
  const missing = inventoryIds.find((id) => !stockById.has(id));
  if (missing) {
    res.status(400).json({ error: `Inventory item ${missing} was not found on this business.` });
    return;
  }

  const saleItems = input.items.map((item) => {
    const stock = stockById.get(item.inventoryId)!;
    return {
      inventoryId: item.inventoryId,
      sku: stock.sku ?? null,
      description: String(stock.name),
      quantity: item.quantity,
      rate: Number(stock.unit_price),
    };
  });
  const amountPaid = saleItems.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const description = saleItems.length === 1 ? saleItems[0].description : `${saleItems.length} items`;

  let receiptNumber: string;
  {
    const { data: reserved, error: numberError } = await supabase.rpc("next_document_number", {
      p_business_id: input.businessId,
      p_document_type: "receipt",
      p_default_prefix: "REC",
    });
    if (numberError) {
      res.status(400).json({ error: numberError.message });
      return;
    }
    receiptNumber = reserved as string;
  }

  const currency = input.currency ?? (await resolveBusinessCurrency(supabase, input.businessId));

  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      business_id: input.businessId,
      customer_id: input.customerId ?? null,
      date: input.date,
      type: "income",
      category: "Client Project",
      amount: amountPaid,
      description,
      payment_method: input.paymentMethod,
      currency,
      exchange_rate_to_business_currency: input.exchangeRateToBusinessCurrency,
    })
    .select("id")
    .single();
  if (txError) console.error("[receipts] pos-sale: failed to log companion transaction:", txError.message);

  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .insert({
      user_id: userId,
      business_id: input.businessId,
      customer_id: input.customerId ?? null,
      // receipts_customer_or_custom_client requires one of these two - a POS
      // sale is the one flow where genuinely neither is known (an anonymous
      // walk-in), so this defaults the name rather than weakening that
      // constraint for every other receipt-creation path too.
      custom_client_name: input.customerId ? null : input.customClientName ?? "Walk-in Customer",
      receipt_number: receiptNumber,
      date: input.date,
      description,
      amount_paid: amountPaid,
      payment_method: input.paymentMethod,
      currency,
      exchange_rate_to_business_currency: input.exchangeRateToBusinessCurrency,
      transaction_id: transaction?.id ?? null,
    })
    .select("*")
    .single();

  if (receiptError) {
    if (transaction?.id) await supabase.from("transactions").delete().eq("id", transaction.id);
    res.status(400).json({ error: receiptError.message });
    return;
  }

  const { error: itemsError } = await supabase.from("receipt_items").insert(
    saleItems.map((item, index) => ({
      receipt_id: receipt.id,
      user_id: userId,
      inventory_id: item.inventoryId,
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      position: index,
    }))
  );
  if (itemsError) console.error("[receipts] pos-sale: failed to save line items:", itemsError.message);

  for (const item of saleItems) {
    const stock = stockById.get(item.inventoryId)!;
    const oldQuantity = Number(stock.quantity);
    const newQuantity = Math.max(0, oldQuantity - item.quantity);
    const { error: decrementError } = await supabase.from("inventory").update({ quantity: newQuantity }).eq("id", item.inventoryId);
    if (decrementError) {
      console.error("[receipts] pos-sale: failed to decrement stock:", decrementError.message);
      continue;
    }
    await checkLowStockAndNotify({
      userId,
      businessId: input.businessId,
      itemId: item.inventoryId,
      itemName: item.description,
      oldQuantity,
      newQuantity,
      minStockAlert: Number(stock.min_stock_alert),
      recipientEmail: req.user!.email,
    });
  }

  await invalidate(`cache:receipts:${userId}`, `cache:transactions:${userId}`, `cache:inventory:${userId}`);
  res.status(201).json({ data: { ...fromRow(receipt), items: saleItems } });
});

receiptsRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = receiptUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;
  const { changeReason, ...input } = parsed.data;

  // A receipt is proof of payment, so it is locked from the moment it exists
  // (see documentIntegrity.ts): any change needs a written reason, is logged
  // BEFORE it is applied, and the receipt number can never change.
  const { data: existing, error: existingError } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (existingError) {
    res.status(400).json({ error: existingError.message });
    return;
  }
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (input.receiptNumber !== undefined && input.receiptNumber !== existing.receipt_number) {
    respondNumberLocked(res, "receipt");
    return;
  }
  const reason = parseReason(changeReason);
  if (!reason) {
    respondReasonRequired(res, "receipt");
    return;
  }

  const row: Record<string, unknown> = {};
  if (input.customerId !== undefined) row.customer_id = input.customerId ?? null;
  if (input.customClientName !== undefined) row.custom_client_name = input.customClientName ?? null;
  if (input.invoiceId !== undefined) row.invoice_id = input.invoiceId ?? null;
  if (input.receiptNumber !== undefined) row.receipt_number = input.receiptNumber;
  if (input.date !== undefined) row.date = input.date;
  if (input.description !== undefined) row.description = input.description;
  if (input.amountPaid !== undefined) row.amount_paid = input.amountPaid;
  if (input.paymentMethod !== undefined) row.payment_method = input.paymentMethod;
  if (input.currency !== undefined) row.currency = input.currency;
  if (input.exchangeRateToBusinessCurrency !== undefined) row.exchange_rate_to_business_currency = input.exchangeRateToBusinessCurrency;

  if (Object.keys(row).length === 0) {
    res.status(400).json({ error: "No updatable fields provided" });
    return;
  }

  const pairs: Array<[string, unknown, unknown]> = [];
  const track = (key: string, before: unknown, after: unknown) => {
    if (after !== undefined) pairs.push([key, before, after]);
  };
  track("customerId", existing.customer_id, input.customerId);
  track("customClientName", existing.custom_client_name, input.customClientName);
  track("invoiceId", existing.invoice_id, input.invoiceId);
  track("date", existing.date, input.date);
  track("description", existing.description, input.description);
  track("amountPaid", Number(existing.amount_paid), input.amountPaid);
  track("paymentMethod", existing.payment_method, input.paymentMethod);
  track("currency", existing.currency, input.currency);
  track("exchangeRateToBusinessCurrency", Number(existing.exchange_rate_to_business_currency), input.exchangeRateToBusinessCurrency);
  const changes = diffFields(pairs);
  if (Object.keys(changes).length === 0) {
    res.status(400).json({ error: "Nothing was changed." });
    return;
  }

  try {
    await logDocumentChange(supabase, {
      businessId: existing.business_id,
      userId,
      documentType: "receipt",
      documentId: existing.id,
      documentNumber: existing.receipt_number,
      action: "amended",
      reason,
      changes,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Couldn't save the change history." });
    return;
  }

  const { data, error } = await supabase
    .from("receipts")
    .update(row)
    .eq("id", req.params.id)
    .select("*")
    .maybeSingle();

  if (error) {
    await logAmendmentFailed(
      supabase,
      { businessId: existing.business_id, userId, documentType: "receipt", documentId: existing.id, documentNumber: existing.receipt_number },
      error.message
    );
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // Keeps the companion transaction (see POST above) in sync with whatever
  // just changed on the receipt, so the ledger doesn't silently drift from
  // the amended amount/date/etc - the gap flagged in the September audit.
  if (existing.transaction_id) {
    const txUpdate: Record<string, unknown> = {};
    if (input.amountPaid !== undefined) txUpdate.amount = input.amountPaid;
    if (input.date !== undefined) txUpdate.date = input.date;
    if (input.description !== undefined) txUpdate.description = input.description;
    if (input.paymentMethod !== undefined) txUpdate.payment_method = input.paymentMethod;
    if (input.customerId !== undefined) txUpdate.customer_id = input.customerId ?? null;
    if (input.currency !== undefined) txUpdate.currency = input.currency;
    if (input.exchangeRateToBusinessCurrency !== undefined) txUpdate.exchange_rate_to_business_currency = input.exchangeRateToBusinessCurrency;

    if (Object.keys(txUpdate).length > 0) {
      const { error: txSyncError } = await supabase.from("transactions").update(txUpdate).eq("id", existing.transaction_id);
      if (txSyncError) console.error("[receipts] failed to sync companion transaction:", txSyncError.message);
    }
  }

  await invalidate(`cache:receipts:${userId}`, `cache:transactions:${userId}`);
  res.json({ data: fromRow(data) });
});

receiptsRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data: existing, error: existingError } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();
  if (existingError) {
    res.status(400).json({ error: existingError.message });
    return;
  }
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const reason = parseReason(req.body?.changeReason);
  if (!reason) {
    respondReasonRequired(res, "receipt");
    return;
  }
  try {
    await logDocumentChange(supabase, {
      businessId: existing.business_id,
      userId,
      documentType: "receipt",
      documentId: existing.id,
      documentNumber: existing.receipt_number,
      action: "deleted",
      reason,
      changes: { snapshot: fromRow(existing) },
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Couldn't save the change history." });
    return;
  }

  const { data, error } = await supabase
    .from("receipts")
    .delete()
    .eq("id", req.params.id)
    .select("id")
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  // A deleted receipt shouldn't leave its companion income entry behind
  // overstating the ledger - same gap as the PATCH handler above, just for
  // the delete path.
  if (existing.transaction_id) {
    const { error: txDeleteError } = await supabase.from("transactions").delete().eq("id", existing.transaction_id);
    if (txDeleteError) console.error("[receipts] failed to delete companion transaction:", txDeleteError.message);
  }

  await invalidate(`cache:receipts:${userId}`, `cache:transactions:${userId}`);
  res.status(204).send();
});

receiptsRouter.post("/:id/send-email", async (req: Request, res: Response) => {
  if (!isEmailConfigured()) {
    res.status(503).json({ error: "Email sending is not configured on this server (RESEND_API_KEY is not set)." });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .select("*")
    .eq("id", req.params.id)
    .maybeSingle();

  if (receiptError) {
    res.status(400).json({ error: receiptError.message });
    return;
  }
  if (!receipt) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const [{ data: business }, { data: customer }] = await Promise.all([
    supabase.from("businesses").select("name").eq("id", receipt.business_id).single(),
    receipt.customer_id
      ? supabase.from("customers").select("name, email").eq("id", receipt.customer_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const recipientEmail = customer?.email;
  if (!recipientEmail) {
    res.status(400).json({ error: "This customer has no email address on file." });
    return;
  }

  const html = renderReceiptEmailHtml({
    business: { name: business?.name ?? "Your Business" },
    currency: receipt.currency,
    receiptNumber: receipt.receipt_number,
    date: receipt.date,
    customerName: customer?.name ?? receipt.custom_client_name ?? "Valued Customer",
    description: receipt.description ?? "",
    amountPaid: Number(receipt.amount_paid),
    paymentMethod: receipt.payment_method,
  });

  try {
    await sendTransactionalEmail({
      to: recipientEmail,
      subject: `Receipt ${receipt.receipt_number} from ${business?.name ?? "Aziiki"}`,
      html,
    });
  } catch (err) {
    // resendClient throws EmailSendError with a message that's already
    // written for a non-technical reader - pass it straight through rather
    // than re-wrapping it in technical framing.
    res.status(502).json({ error: err instanceof Error ? err.message : "We couldn't send this email right now. Please try again shortly." });
    return;
  }

  res.json({ message: `Receipt emailed to ${recipientEmail}.` });
});
