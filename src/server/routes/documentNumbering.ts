import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { documentTypeField } from "../validation/documentTemplates";

const peekQuerySchema = z.object({
  businessId: z.string().uuid(),
  documentType: documentTypeField,
  defaultPrefix: z.string().trim().max(10).optional(),
});

// Only the three document types the builder (InvoiceReceiptBuilder.tsx)
// actually generates - the wider documentTypeField enum exists for the
// document-templates feature, most of which this app doesn't create yet.
const CONFIGURABLE_DOCUMENT_TYPES = ["invoice", "receipt", "quotation"] as const;

const settingsUpdateSchema = z.object({
  businessId: z.string().uuid(),
  documentType: z.enum(CONFIGURABLE_DOCUMENT_TYPES),
  prefix: z.string().trim().min(1).max(10),
  padding: z.number().int().min(1).max(10),
  resetPeriod: z.enum(["never", "yearly"]),
});

export const documentNumberingRouter = Router();

function fromSettingsRow(row: any, documentType: string) {
  return {
    documentType,
    prefix: row?.prefix ?? documentType.slice(0, 3).toUpperCase(),
    padding: row?.padding ?? 4,
    resetPeriod: row?.reset_period ?? "never",
    nextNumber: row?.next_number ?? 1,
  };
}

// Current numbering config for all three configurable document types, in
// one call - the settings screen shows all three side by side rather than
// one at a time.
documentNumberingRouter.get("/settings", async (req: Request, res: Response) => {
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  if (!businessId) {
    res.status(400).json({ error: "businessId is required" });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("document_numbering_sequences")
    .select("document_type, prefix, padding, reset_period, next_number")
    .eq("business_id", businessId)
    .in("document_type", CONFIGURABLE_DOCUMENT_TYPES);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const byType = new Map((data ?? []).map((row) => [row.document_type, row]));
  res.json({
    data: CONFIGURABLE_DOCUMENT_TYPES.map((type) => fromSettingsRow(byType.get(type), type)),
  });
});

// Updates prefix/padding/resetPeriod for one document type. Never touches
// next_number directly - changing the format doesn't retroactively
// renumber already-issued documents, it only changes what the NEXT one
// looks like.
documentNumberingRouter.put("/settings", async (req: Request, res: Response) => {
  const parsed = settingsUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const userId = req.user!.id;
  const { businessId, documentType, prefix, padding, resetPeriod } = parsed.data;

  // Upsert: a business that has never actually issued this document type
  // yet has no row in document_numbering_sequences (next_document_number()
  // creates it lazily, on first real reservation) - the settings screen
  // must still be able to pre-configure it before that first document.
  const { data: updated, error } = await supabase
    .from("document_numbering_sequences")
    .upsert(
      { user_id: userId, business_id: businessId, document_type: documentType, prefix, padding, reset_period: resetPeriod },
      { onConflict: "business_id,document_type" }
    )
    .select("document_type, prefix, padding, reset_period, next_number")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  await supabase.from("document_numbering_audit_log").insert({
    business_id: businessId,
    document_type: documentType,
    user_id: userId,
    action: "settings_changed",
    details: { prefix, padding, resetPeriod },
  });

  res.json({ data: fromSettingsRow(updated, documentType) });
});

// Read-only audit trail - every reservation (next_document_number()) and
// every settings change, newest first.
documentNumberingRouter.get("/audit-log", async (req: Request, res: Response) => {
  const businessId = typeof req.query.businessId === "string" ? req.query.businessId : undefined;
  if (!businessId) {
    res.status(400).json({ error: "businessId is required" });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("document_numbering_audit_log")
    .select("id, document_type, action, formatted_number, details, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({
    data: (data ?? []).map((row) => ({
      id: row.id,
      documentType: row.document_type,
      action: row.action,
      formattedNumber: row.formatted_number ?? undefined,
      details: row.details ?? undefined,
      createdAt: row.created_at,
    })),
  });
});

// Read-only preview of what the NEXT number would look like, without
// reserving it - lets the builder UI show "INV-0042" while the user is
// still filling out the form. The real, atomic reservation only happens
// when the document is actually created (see next_document_number() calls
// in invoices.ts/receipts.ts/quotations.ts).
documentNumberingRouter.get("/peek", async (req: Request, res: Response) => {
  const parsed = peekQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { businessId, documentType, defaultPrefix } = parsed.data;

  const { data, error } = await supabase
    .from("document_numbering_sequences")
    .select("next_number, prefix, padding")
    .eq("business_id", businessId)
    .eq("document_type", documentType)
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const prefix = data?.prefix ?? defaultPrefix ?? documentType.slice(0, 3).toUpperCase();
  const nextNumber = data?.next_number ?? 1;
  const padding = data?.padding ?? 4;

  res.json({ preview: `${prefix}-${String(nextNumber).padStart(padding, "0")}` });
});
