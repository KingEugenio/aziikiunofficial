import { Router, type Request, type Response } from "express";
import { z } from "zod";

export const adminSubscriptionPlansRouter = Router();

const planUpsertSchema = z.object({
  paystackLink: z.string().trim().url().max(500).optional().nullable(),
  priceMinorUnits: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().trim().length(3).optional(),
});

function fromRow(row: any) {
  return {
    tier: row.tier,
    paystackLink: row.paystack_link,
    priceMinorUnits: row.price_minor_units,
    currency: row.currency,
    updatedAt: row.updated_at,
  };
}

// Both paid tiers, always both rows (upserted below) - "standard" and
// "pro" - so the admin composer always has something to edit even before
// either has ever been configured.
adminSubscriptionPlansRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { data, error } = await supabase.from("subscription_plans").select("*").order("tier");

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const byTier = new Map((data ?? []).map((row) => [row.tier, row]));
  const rows = ["standard", "pro"].map((tier) => byTier.get(tier) ?? { tier, paystack_link: null, price_minor_units: null, currency: "GHS" });

  res.json({ data: rows.map(fromRow) });
});

adminSubscriptionPlansRouter.put("/:tier", async (req: Request, res: Response) => {
  const tier = req.params.tier;
  if (tier !== "standard" && tier !== "pro") {
    res.status(400).json({ error: "tier must be 'standard' or 'pro'." });
    return;
  }

  const parsed = planUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("subscription_plans")
    .upsert(
      {
        tier,
        paystack_link: parsed.data.paystackLink ?? null,
        price_minor_units: parsed.data.priceMinorUnits ?? null,
        currency: parsed.data.currency ?? "GHS",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tier" }
    )
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: fromRow(data) });
});

// Manual override: grant/set a specific user's tier directly (e.g.
// comping an account, or fixing a webhook-matching miss) without them
// having to pay again.
adminSubscriptionPlansRouter.put("/users/:email/tier", async (req: Request, res: Response) => {
  const tier = req.body?.tier;
  if (tier !== "basic" && tier !== "standard" && tier !== "pro") {
    res.status(400).json({ error: "tier must be 'basic', 'standard', or 'pro'." });
    return;
  }

  const supabase = req.supabase!;
  const { data: profile, error: findError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", req.params.email.toLowerCase())
    .maybeSingle();

  if (findError) {
    res.status(400).json({ error: findError.message });
    return;
  }
  if (!profile) {
    res.status(404).json({ error: "No account found with that email." });
    return;
  }

  const { error: updateError } = await supabase.from("profiles").update({ tier }).eq("id", profile.id);
  if (updateError) {
    res.status(400).json({ error: updateError.message });
    return;
  }

  res.json({ data: { email: req.params.email, tier } });
});
