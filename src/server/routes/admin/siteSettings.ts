import { Router, type Request, type Response } from "express";
import { z } from "zod";

export const adminSiteSettingsRouter = Router();

const KNOWN_KEYS = [
  "support_email",
  "support_phone",
  "whatsapp_link",
  "social_instagram",
  "social_facebook",
  "social_tiktok",
  "legal_terms_of_service",
  "legal_refund_policy",
] as const;

adminSiteSettingsRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { data, error } = await supabase.from("site_settings").select("key, value, updated_at");

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const byKey = new Map((data ?? []).map((row) => [row.key, row.value]));
  res.json({ data: KNOWN_KEYS.map((key) => ({ key, value: byKey.get(key) ?? "" })) });
});

const updateSchema = z.object({
  key: z.enum(KNOWN_KEYS),
  value: z.string().max(20000),
});

adminSiteSettingsRouter.put("/", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { error } = await supabase
    .from("site_settings")
    .upsert({ key: parsed.data.key, value: parsed.data.value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: { key: parsed.data.key, value: parsed.data.value } });
});
