import type { Request, Response, NextFunction } from "express";

// Same tier-ceiling convention as TIER_MAX_BUSINESSES in businessLimits.ts.
// Deliberately generous compared to typical free-tier contact caps
// elsewhere in the market (e.g. Zoho Books doesn't cap contacts at all,
// most CRM-adjacent free tiers cap in the 20-100 range) - a genuinely
// small business (Aziiki's actual target user) realistically has well
// under 40 active customers, so this only becomes a real constraint once
// a business has clearly outgrown "just getting started," which is
// exactly when upgrading makes sense.
const TIER_MAX_CUSTOMERS: Record<string, number> = { basic: 40, standard: 250, pro: Infinity };

async function getTier(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("tier").eq("id", userId).maybeSingle();
  return data?.tier ?? "basic";
}

/**
 * Mounted ahead of customersRouter (see app.ts) - enforces the per-tier
 * customer-count cap on create only; editing/deleting existing customers
 * is never blocked, so a Basic account that's already over the cap (e.g.
 * downgraded from a higher tier) can still manage who they already have,
 * they just can't add more until they free up room or upgrade.
 */
export async function enforceCustomerLimits(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.method !== "POST") {
    next();
    return;
  }

  const supabase = req.supabase!;
  const userId = req.user!.id;
  const businessId = typeof req.body?.businessId === "string" ? req.body.businessId : undefined;

  if (!businessId) {
    next();
    return;
  }

  const tier = await getTier(supabase, userId);
  const max = TIER_MAX_CUSTOMERS[tier] ?? TIER_MAX_CUSTOMERS.basic;
  if (max === Infinity) {
    next();
    return;
  }

  const { count, error } = await supabase
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  if ((count ?? 0) >= max) {
    res.status(403).json({
      error:
        tier === "basic"
          ? `Basic accounts can store up to ${max} customers per business. Upgrade to Standard for up to ${TIER_MAX_CUSTOMERS.standard}, or Pro for unlimited.`
          : `Your ${tier} plan supports up to ${max} customers per business. Upgrade to add more.`,
    });
    return;
  }

  next();
}
