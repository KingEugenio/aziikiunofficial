import { Router, type Request, type Response } from "express";
import { z } from "zod";

const querySchema = z.object({
  businessId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
});

export const documentChangeLogRouter = Router();

// Read-only: the log is written only by the invoice/receipt routes (see
// documentIntegrity.ts) and has no update or delete policy, so this is the
// only thing anyone can do with it. Newest first.
documentChangeLogRouter.get("/", async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "businessId is required" });
    return;
  }

  let query = req
    .supabase!.from("document_change_log")
    .select("id, user_id, document_type, document_id, document_number, action, reason, changes, created_at")
    .eq("business_id", parsed.data.businessId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (parsed.data.documentId) query = query.eq("document_id", parsed.data.documentId);

  const { data, error } = await query;
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({
    data: (data ?? []).map((row) => ({
      id: row.id,
      changedByMe: row.user_id === req.user!.id,
      documentType: row.document_type,
      documentId: row.document_id,
      documentNumber: row.document_number ?? undefined,
      action: row.action,
      reason: row.reason ?? undefined,
      changes: row.changes ?? {},
      createdAt: row.created_at,
    })),
  });
});
