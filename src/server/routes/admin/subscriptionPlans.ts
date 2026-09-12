import { Router, type Request, type Response } from "express";
import { z } from "zod";

export const adminSubscriptionPlansRouter = Router();

const planUpsertSchema = z.object({
  paystackLink: z.string().trim().url().max(500).optional().nullable(),
  priceMinorUnits: z.number().int().nonnegative().optional().nullable(),
  provider: z.enum(["paystack", "stripe"]).optional(),
});

const CURRENCY_RE = /^[A-Z]{3}$/;

function fromRow(row: any) {
  return {
    tier: row.tier,
    currency: row.currency,
    paystackLink: row.paystack_link,
    priceMinorUnits: row.price_minor_units,
    provider: row.provider,
    updatedAt: row.updated_at,
  };
}

// Every configured (tier, currency) row - grouped by tier client-side. Both
// paid tiers always get a GHS row even before anyone's touched it, so the
// admin composer always has a starting point to edit; any other currency
// row only appears once it's been added.
adminSubscriptionPlansRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { data, error } = await supabase.from("subscription_plans").select("*").order("tier").order("currency");

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const rows = data ?? [];
  for (const tier of ["standard", "pro"]) {
    if (!rows.some((r) => r.tier === tier && r.currency === "GHS")) {
      rows.push({ tier, currency: "GHS", paystack_link: null, price_minor_units: null, provider: "paystack" });
    }
  }
  rows.sort((a, b) => a.tier.localeCompare(b.tier) || a.currency.localeCompare(b.currency));

  res.json({ data: rows.map(fromRow) });
});

adminSubscriptionPlansRouter.put("/:tier/:currency", async (req: Request, res: Response) => {
  const tier = req.params.tier;
  if (tier !== "standard" && tier !== "pro") {
    res.status(400).json({ error: "tier must be 'standard' or 'pro'." });
    return;
  }
  const currency = req.params.currency.toUpperCase();
  if (!CURRENCY_RE.test(currency)) {
    res.status(400).json({ error: "currency must be a 3-letter code, e.g. GHS." });
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
        currency,
        paystack_link: parsed.data.paystackLink ?? null,
        price_minor_units: parsed.data.priceMinorUnits ?? null,
        provider: parsed.data.provider ?? "paystack",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tier,currency" }
    )
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: fromRow(data) });
});

// Remove a currency row entirely (e.g. a currency added by mistake, or no
// longer offered) - the two default GHS rows can still be removed here
// too; GET re-adds an empty placeholder for them next load since they're
// the baseline every tier is assumed to need.
adminSubscriptionPlansRouter.delete("/:tier/:currency", async (req: Request, res: Response) => {
  const tier = req.params.tier;
  const currency = req.params.currency.toUpperCase();
  const supabase = req.supabase!;
  const { error } = await supabase.from("subscription_plans").delete().eq("tier", tier).eq("currency", currency);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(204).send();
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
