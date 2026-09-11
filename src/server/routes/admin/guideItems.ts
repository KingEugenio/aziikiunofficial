import { Router, type Request, type Response } from "express";
import { z } from "zod";

export const adminGuideItemsRouter = Router();

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
});

function fromRow(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    isDone: row.is_done,
    createdAt: row.created_at,
  };
}

adminGuideItemsRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { data, error } = await supabase.from("admin_guide_items").select("*").order("is_done").order("created_at");

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: (data ?? []).map(fromRow) });
});

adminGuideItemsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("admin_guide_items")
    .insert({ title: parsed.data.title, description: parsed.data.description ?? null })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ data: fromRow(data) });
});

adminGuideItemsRouter.patch("/:id", async (req: Request, res: Response) => {
  const isDone = typeof req.body?.isDone === "boolean" ? req.body.isDone : undefined;
  if (isDone === undefined) {
    res.status(400).json({ error: "isDone (boolean) is required." });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase.from("admin_guide_items").update({ is_done: isDone }).eq("id", req.params.id).select("*").maybeSingle();

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

adminGuideItemsRouter.delete("/:id", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { error } = await supabase.from("admin_guide_items").delete().eq("id", req.params.id);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(204).send();
});
