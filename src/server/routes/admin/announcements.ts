import { Router, type Request, type Response } from "express";
import { announcementCreateSchema } from "../../validation/admin";

export const adminAnnouncementsRouter = Router();

function fromRow(row: any) {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    targetScreen: row.target_screen,
    targetTier: row.target_tier,
    targetActivity: row.target_activity,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// Every announcement plus how many users have read it, for a "seen by N"
// count in the portal.
adminAnnouncementsRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const { data: announcements, error } = await supabase
    .from("admin_announcements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const { data: reads, error: readsError } = await supabase.from("admin_announcement_reads").select("announcement_id");

  if (readsError) {
    res.status(400).json({ error: readsError.message });
    return;
  }

  const readCounts = new Map<string, number>();
  for (const row of reads ?? []) {
    readCounts.set(row.announcement_id, (readCounts.get(row.announcement_id) ?? 0) + 1);
  }

  res.json({ data: (announcements ?? []).map((row) => ({ ...fromRow(row), readCount: readCounts.get(row.id) ?? 0 })) });
});

adminAnnouncementsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = announcementCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("admin_announcements")
    .insert({
      title: parsed.data.title,
      message: parsed.data.message,
      target_screen: parsed.data.targetScreen ?? "all",
      target_tier: parsed.data.targetTier ?? "all",
      target_activity: parsed.data.targetActivity ?? "all",
      created_by: req.user!.id,
    })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ data: fromRow(data) });
});

adminAnnouncementsRouter.patch("/:id", async (req: Request, res: Response) => {
  const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;
  if (isActive === undefined) {
    res.status(400).json({ error: "isActive (boolean) is required." });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("admin_announcements")
    .update({ is_active: isActive })
    .eq("id", req.params.id)
    .select("*")
    .maybeSingle();

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

// Permanently remove an announcement (e.g. a duplicate, a typo'd draft, or
// one that's no longer relevant) - deactivating only hides it from users'
// feeds but still leaves it cluttering the admin list forever, which is
// what prompted this. admin_announcement_reads rows for it are cleaned up
// via the table's own foreign-key cascade (migration 0033).
adminAnnouncementsRouter.delete("/:id", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { error } = await supabase.from("admin_announcements").delete().eq("id", req.params.id);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(204).send();
});
