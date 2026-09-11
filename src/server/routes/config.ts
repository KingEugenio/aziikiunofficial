import { Router, type Request, type Response } from "express";
import { isEmailConfigured } from "../email/resendClient";
import { isPaystackConfigured } from "../payments/paystackClient";
import { getAnonClient, getUserScopedClient } from "../supabaseClients";
import { env } from "../env";

// A tier's ceiling on feature_flags.phase - see migration 0042.
// pro has no cap (Infinity), so every phase clears it.
const TIER_MAX_PHASE: Record<string, number> = { basic: 1, standard: 2, pro: Infinity };

/**
 * Public, non-sensitive feature flags the frontend needs before a user is
 * even signed in (e.g. to disable a button rather than let them click it
 * and hit a 503). Never expose actual secret values here.
 *
 * `flags` is the computed, per-caller feature-flag set (see migration 0032
 * and 0042): a flag is on when feature_flags.enabled_default is true AND
 * its phase clears the caller's subscription tier ceiling - with the
 * caller's own user_feature_overrides layered on top and always winning
 * either way (an admin manually granting one user early access is a
 * deliberate override, not something a tier ceiling should block).
 * Anonymous/basic-tier callers just get phase-1 flags (there are none -
 * Phase 1 is always-on and never behind a flag - so this normally yields
 * an empty flags map for them). This is deliberately mounted as a public
 * route (see app.ts) rather than under requireAuth so the pre-login
 * screens (auth method choice, onboarding) can read it too.
 */
export const configRouter = Router();

configRouter.get("/features", async (req: Request, res: Response) => {
  // Deliberately never lets a feature-flags read failure take down this
  // whole endpoint - emailSendingEnabled/paystackEnabled are load-bearing
  // for the pre-login screens regardless of whether the flags tables (or
  // their migration) are in place yet, so any error here degrades to "no
  // flags" (everything gated off) rather than a 500/400.
  const flags: Record<string, boolean> = {};
  let tier = "basic";
  // No cap until we can prove one applies - if profiles.tier doesn't exist
  // yet (migration 0042 not applied), this must behave exactly like before
  // tiers existed (enabled_default alone decides), not silently lock every
  // Phase-2+ flag behind a "basic" ceiling nobody configured yet.
  let maxPhase = Infinity;
  try {
    const anonClient = getAnonClient();
    const { data: flagRows, error: flagsError } = await anonClient.from("feature_flags").select("key, enabled_default, phase");
    if (flagsError) throw flagsError;

    const authHeader = req.headers.authorization;
    let overrides: Record<string, boolean> = {};
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      if (token) {
        const userClient = getUserScopedClient(token);
        const { data: userData } = await userClient.auth.getUser(token);
        if (userData?.user) {
          const { data: profileRow, error: profileError } = await userClient
            .from("profiles")
            .select("tier")
            .eq("id", userData.user.id)
            .maybeSingle();
          if (!profileError && profileRow?.tier) {
            tier = profileRow.tier;
            maxPhase = TIER_MAX_PHASE[tier] ?? TIER_MAX_PHASE.basic;
          }

          const { data: overrideRows } = await userClient
            .from("user_feature_overrides")
            .select("flag_key, enabled")
            .eq("user_id", userData.user.id);
          for (const row of overrideRows ?? []) {
            overrides[row.flag_key] = row.enabled;
          }
        }
      }
    }

    for (const row of flagRows ?? []) {
      flags[row.key] = row.key in overrides ? overrides[row.key] : row.enabled_default && row.phase <= maxPhase;
    }
  } catch (err) {
    console.error("[config/features] failed to load feature flags:", err);
  }

  res.json({ emailSendingEnabled: isEmailConfigured(), paystackEnabled: isPaystackConfigured(), flags, tier });
});

/**
 * The active admin-uploaded logo/favicon (see migration 0035 and
 * src/admin/BrandingPanel.tsx), or null if the admin has never uploaded
 * one - the app falls back to its built-in mark (src/components/Logo.tsx)
 * and the static favicon in index.html in that case. Public: the browser
 * tab's favicon has to be set before anyone signs in.
 */
configRouter.get("/branding", async (_req: Request, res: Response) => {
  const anonClient = getAnonClient();
  const { data, error } = await anonClient
    .from("site_assets")
    .select("kind, storage_path")
    .in("kind", ["logo", "favicon"])
    .eq("is_active", true);

  if (error) {
    // Same fail-open reasoning as /features above - a missing table before
    // migration 0035 is applied must not break every page load.
    res.json({ logoUrl: null, faviconUrl: null });
    return;
  }

  const urlFor = (path: string) => `${env.SUPABASE_URL}/storage/v1/object/public/site-assets/${path}`;
  const logo = (data ?? []).find((row) => row.kind === "logo");
  const favicon = (data ?? []).find((row) => row.kind === "favicon");

  res.json({
    logoUrl: logo ? urlFor(logo.storage_path) : null,
    faviconUrl: favicon ? urlFor(favicon.storage_path) : null,
  });
});

/**
 * The two paid tiers' upgrade destinations (see migration 0042 and
 * /admin -> Payments) - a Paystack Payment Page link plus its price, for
 * rendering "Upgrade to Standard/Pro" buttons. Public: readable even
 * signed-out so a pricing/upgrade prompt can show before login.
 */
configRouter.get("/plans", async (_req: Request, res: Response) => {
  const anonClient = getAnonClient();
  const { data, error } = await anonClient
    .from("subscription_plans")
    .select("tier, paystack_link, price_minor_units, currency");

  if (error) {
    // Fail open to an empty list (same reasoning as /features and
    // /branding above) - a missing table before migration 0042 is applied
    // must not break every page load.
    res.json({ data: [] });
    return;
  }

  res.json({
    data: (data ?? []).map((row) => ({
      tier: row.tier,
      paystackLink: row.paystack_link,
      priceMinorUnits: row.price_minor_units,
      currency: row.currency,
    })),
  });
});
