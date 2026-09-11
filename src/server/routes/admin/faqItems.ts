import { Router, type Request, type Response } from "express";
import { z } from "zod";

export const adminFaqItemsRouter = Router();

function fromRow(row: any) {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

adminFaqItemsRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { data, error } = await supabase.from("faq_items").select("*").order("sort_order").order("created_at");

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: (data ?? []).map(fromRow) });
});

const createSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(3000),
  sortOrder: z.number().int().default(0),
});

adminFaqItemsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("faq_items")
    .insert({ question: parsed.data.question, answer: parsed.data.answer, sort_order: parsed.data.sortOrder })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ data: fromRow(data) });
});

const updateSchema = z.object({
  question: z.string().trim().min(1).max(300).optional(),
  answer: z.string().trim().min(1).max(3000).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

adminFaqItemsRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.question !== undefined) updates.question = parsed.data.question;
  if (parsed.data.answer !== undefined) updates.answer = parsed.data.answer;
  if (parsed.data.sortOrder !== undefined) updates.sort_order = parsed.data.sortOrder;
  if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive;

  const supabase = req.supabase!;
  const { data, error } = await supabase.from("faq_items").update(updates).eq("id", req.params.id).select("*").maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ data: fromRow(data) });
});

adminFaqItemsRouter.delete("/:id", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { error } = await supabase.from("faq_items").delete().eq("id", req.params.id);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(204).send();
});
