import type { Request, Response, NextFunction } from "express";

// Same tier-ceiling convention as TIER_MAX_PHASE in config.ts: Basic gets
// one business profile, Standard three, Pro five - explicit product
// decision, Pro is no longer unlimited. Personal Workspace
// (businesses.is_personal = true) doesn't count against this - it's a
// separate always-available feature, not a business profile someone would
// use to game the limit.
const TIER_MAX_BUSINESSES: Record<string, number> = { basic: 1, standard: 3, pro: 5 };

// A business's name can be changed at most this many times - without a cap,
// a Basic account (limited to one business profile above) could rename its
// one business over and over to cycle through unrelated businesses on a
// single free account, defeating the whole point of the per-tier limit.
const MAX_NAME_EDITS = 2;

async function getTier(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("tier").eq("id", userId).maybeSingle();
  return data?.tier ?? "basic";
}

/**
 * Mounted ahead of businessesRouter (see app.ts) - enforces the per-tier
 * business-count cap on create, and the name-edit cap on update. Kept as
 * its own middleware rather than built into the generic CRUD factory
 * (crudFactory.ts) since these rules are specific to this one resource.
 */
export async function enforceBusinessLimits(req: Request, res: Response, next: NextFunction): Promise<void> {
  const supabase = req.supabase!;
  const userId = req.user!.id;

  if (req.method === "POST") {
    // Only real business profiles count - Personal Workspace is separate
    // and created automatically, not something a user "adds" here.
    const { count, error } = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_personal", false);

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    const tier = await getTier(supabase, userId);
    const max = TIER_MAX_BUSINESSES[tier] ?? TIER_MAX_BUSINESSES.basic;
    if ((count ?? 0) >= max) {
      res.status(403).json({
        error:
          tier === "basic"
            ? "Basic accounts can have one business profile. Upgrade to Standard for up to 3, or Pro for up to 5."
            : `Your ${tier} plan supports up to ${max} business profiles.${tier === "pro" ? "" : " Upgrade to add more."}`,
      });
      return;
    }
    next();
    return;
  }

  if (req.method === "PATCH" && typeof req.body?.name === "string") {
    const { data: existing, error } = await supabase
      .from("businesses")
      .select("name, name_edit_count")
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const isRealNameChange = existing.name !== req.body.name;
    if (isRealNameChange) {
      if ((existing.name_edit_count ?? 0) >= MAX_NAME_EDITS) {
        res.status(403).json({
          error: `This business's name has already been changed ${MAX_NAME_EDITS} times, the maximum allowed. Contact support if you need it changed again.`,
        });
        return;
      }
      await supabase
        .from("businesses")
        .update({ name_edit_count: (existing.name_edit_count ?? 0) + 1 })
        .eq("id", req.params.id);
    }
  }

  next();
}
