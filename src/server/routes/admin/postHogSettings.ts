import { Router, type Request, type Response } from "express";
import { z } from "zod";

export const adminPostHogSettingsRouter = Router();

/**
 * A narrow, dedicated view onto the same site_settings table siteSettings.ts
 * manages - scoped to only the three PostHog keys, and gated by its own
 * "posthog" permission section, so an admin granted access to this panel
 * doesn't also get the ability to edit contact info, social links, legal
 * text, or FAQ (which live on the same table but behind "content").
 */
const POSTHOG_KEYS = ["posthog_enabled", "posthog_key", "posthog_host"] as const;

adminPostHogSettingsRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { data, error } = await supabase.from("site_settings").select("key, value").in("key", POSTHOG_KEYS);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const byKey = new Map((data ?? []).map((row) => [row.key, row.value]));
  res.json({ data: POSTHOG_KEYS.map((key) => ({ key, value: byKey.get(key) ?? "" })) });
});

const updateSchema = z.object({
  key: z.enum(POSTHOG_KEYS),
  value: z.string().max(2000),
});

adminPostHogSettingsRouter.put("/", async (req: Request, res: Response) => {
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
