import { Router, type Request, type Response } from "express";
import { flagUpdateSchema, flagOverrideSchema } from "../../validation/admin";
import { findUserByEmail } from "../../lib/findUserByEmail";

export const adminFeatureFlagsRouter = Router();

function fromFlagRow(row: any) {
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    phase: row.phase,
    enabledDefault: row.enabled_default,
    updatedAt: row.updated_at,
  };
}

// List every flag plus how many per-user overrides each has, so the portal
// can show "3 users opted in" without a second round trip per flag.
adminFeatureFlagsRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const { data: flags, error: flagsError } = await supabase
    .from("feature_flags")
    .select("*")
    .order("phase", { ascending: true })
    .order("name", { ascending: true });

  if (flagsError) {
    res.status(400).json({ error: flagsError.message });
    return;
  }

  const { data: overrides, error: overridesError } = await supabase.from("user_feature_overrides").select("flag_key");

  if (overridesError) {
    res.status(400).json({ error: overridesError.message });
    return;
  }

  const overrideCounts = new Map<string, number>();
  for (const row of overrides ?? []) {
    overrideCounts.set(row.flag_key, (overrideCounts.get(row.flag_key) ?? 0) + 1);
  }

  res.json({
    data: (flags ?? []).map((row) => ({ ...fromFlagRow(row), overrideCount: overrideCounts.get(row.key) ?? 0 })),
  });
});

adminFeatureFlagsRouter.patch("/:key", async (req: Request, res: Response) => {
  const parsed = flagUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("feature_flags")
    .update({ enabled_default: parsed.data.enabledDefault })
    .eq("key", req.params.key)
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

  res.json({ data: fromFlagRow(data) });
});

// Per-user overrides for one flag - the "let some users try it out" screen.
// Joins in email via the service-scoped findUserByEmail path only on write;
// reads join through profiles (which mirrors auth.users.email) so this
// never needs the service-role client.
adminFeatureFlagsRouter.get("/:key/overrides", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const { data: overrides, error } = await supabase
    .from("user_feature_overrides")
    .select("user_id, enabled, created_at")
    .eq("flag_key", req.params.key)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const userIds = (overrides ?? []).map((row) => row.user_id);
  let emailByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, email").in("id", userIds);
    if (profilesError) {
      res.status(400).json({ error: profilesError.message });
      return;
    }
    emailByUserId = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  }

  res.json({
    data: (overrides ?? []).map((row) => ({
      userId: row.user_id,
      email: emailByUserId.get(row.user_id) ?? "(unknown)",
      enabled: row.enabled,
      createdAt: row.created_at,
    })),
  });
});

adminFeatureFlagsRouter.put("/:key/overrides", async (req: Request, res: Response) => {
  const parsed = flagOverrideSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const targetUser = await findUserByEmail(parsed.data.email);
  if (!targetUser) {
    res.status(404).json({ error: "No user is registered with that email." });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("user_feature_overrides")
    .upsert(
      { user_id: targetUser.id, flag_key: req.params.key, enabled: parsed.data.enabled },
      { onConflict: "user_id,flag_key" }
    )
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: { userId: data.user_id, email: parsed.data.email, enabled: data.enabled } });
});

adminFeatureFlagsRouter.delete("/:key/overrides/:userId", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const { error } = await supabase
    .from("user_feature_overrides")
    .delete()
    .eq("flag_key", req.params.key)
    .eq("user_id", req.params.userId);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(204).send();
});
