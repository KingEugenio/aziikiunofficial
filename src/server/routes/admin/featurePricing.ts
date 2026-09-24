import { Router, type Request, type Response } from "express";
import { featurePricingUpsertSchema } from "../../validation/featurePricing";
import { findUserByEmail } from "../../lib/findUserByEmail";

export const adminFeaturePricingRouter = Router();

function fromRow(row: any) {
  return {
    flagKey: row.flag_key,
    isPaid: row.is_paid,
    price: row.price_minor_units != null ? row.price_minor_units / 100 : null,
    currency: row.currency,
    billingType: row.billing_type,
    recurringInterval: row.recurring_interval,
    provider: row.provider,
    paymentLink: row.payment_link,
    accessMessage: row.access_message,
    updatedAt: row.updated_at,
  };
}

// Every feature_flags row, left-joined with its pricing if any exists yet -
// so the admin panel always has one row per feature to edit, the same "one
// row per real thing, pricing optional" shape subscriptionPlansRouter uses
// for tiers. A feature with no feature_pricing row is simply free.
adminFeaturePricingRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const [{ data: flags, error: flagsError }, { data: pricing, error: pricingError }] = await Promise.all([
    supabase.from("feature_flags").select("key, name, description, phase").order("phase").order("name"),
    supabase.from("feature_pricing").select("*"),
  ]);

  if (flagsError) {
    res.status(400).json({ error: flagsError.message });
    return;
  }
  if (pricingError) {
    res.status(400).json({ error: pricingError.message });
    return;
  }

  const pricingByKey = new Map((pricing ?? []).map((row) => [row.flag_key, row]));

  res.json({
    data: (flags ?? []).map((flag) => {
      const priceRow = pricingByKey.get(flag.key);
      return {
        flagKey: flag.key,
        name: flag.name,
        description: flag.description,
        phase: flag.phase,
        ...(priceRow
          ? fromRow(priceRow)
          : {
              isPaid: false,
              price: null,
              currency: null,
              billingType: "one_time",
              recurringInterval: null,
              provider: "paystack",
              paymentLink: null,
              accessMessage: null,
              updatedAt: null,
            }),
      };
    }),
  });
});

adminFeaturePricingRouter.put("/:flagKey", async (req: Request, res: Response) => {
  const parsed = featurePricingUpsertSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;

  // The flag itself has to already exist - pricing without a feature to
  // attach it to would be meaningless, and the foreign key would reject it
  // anyway with a much less readable error.
  const { data: flag, error: flagError } = await supabase.from("feature_flags").select("key").eq("key", req.params.flagKey).maybeSingle();
  if (flagError) {
    res.status(400).json({ error: flagError.message });
    return;
  }
  if (!flag) {
    res.status(404).json({ error: `No feature flag "${req.params.flagKey}" exists.` });
    return;
  }

  const { data, error } = await supabase
    .from("feature_pricing")
    .upsert(
      {
        flag_key: req.params.flagKey,
        is_paid: parsed.data.isPaid,
        price_minor_units: parsed.data.price != null ? Math.round(parsed.data.price * 100) : null,
        currency: parsed.data.currency ?? null,
        billing_type: parsed.data.billingType,
        recurring_interval: parsed.data.billingType === "recurring" ? parsed.data.recurringInterval : null,
        provider: parsed.data.provider,
        payment_link: parsed.data.paymentLink ?? null,
        access_message: parsed.data.accessMessage ?? null,
        updated_by: req.user!.id,
      },
      { onConflict: "flag_key" }
    )
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: fromRow(data) });
});

// Marks a feature free again - deletes its pricing row entirely (rather
// than just setting is_paid = false) so GET goes back to reporting it with
// no price at all, cleanly, the same as a feature that was never priced.
adminFeaturePricingRouter.delete("/:flagKey", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { error } = await supabase.from("feature_pricing").delete().eq("flag_key", req.params.flagKey);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(204).send();
});

// Manually grant (or revoke) one user's access to one feature - the exact
// same effect a successful payment has (a user_feature_overrides row), for
// comping an account, a Stripe payment, or fixing a payment the webhook
// couldn't match automatically. Kept on this router (not the Feature Flags
// one) so the "featurePricing" admin section is self-contained: an admin
// who can manage pricing can also grant the access that pricing is for,
// without also needing the separate "flags" section.
adminFeaturePricingRouter.put("/:flagKey/access", async (req: Request, res: Response) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const enabled = req.body?.enabled;
  if (!email) {
    res.status(400).json({ error: "email is required." });
    return;
  }
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be true or false." });
    return;
  }

  const targetUser = await findUserByEmail(email);
  if (!targetUser) {
    res.status(404).json({ error: "No user is registered with that email." });
    return;
  }

  const supabase = req.supabase!;
  const { error } = await supabase
    .from("user_feature_overrides")
    .upsert({ user_id: targetUser.id, flag_key: req.params.flagKey, enabled }, { onConflict: "user_id,flag_key" });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: { email, flagKey: req.params.flagKey, enabled } });
});
