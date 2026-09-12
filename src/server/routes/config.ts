import { Router, type Request, type Response } from "express";
import { isEmailConfigured } from "../email/resendClient";
import { isPaystackConfigured } from "../payments/paystackClient";
import { getAnonClient, getUserScopedClient } from "../supabaseClients";
import { env } from "../env";

// A tier's ceiling on feature_flags.phase - see migration 0042.
// pro has no cap (Infinity), so every phase clears it.
const TIER_MAX_PHASE: Record<string, number> = { basic: 1, standard: 2, pro: Infinity };

// The six Phase 1 "core" screens (migration 0044) default to true. Until
// that migration is applied, these keys simply don't exist in feature_flags
// at all - which must NOT be read as "off": the client's isEnabled(key)
// only knows true/not-true, so a missing key and an explicitly-disabled
// key would look identical, hiding every workspace screen for every real
// user the moment this code shipped, before anyone had a chance to run the
// migration. Backfilling the default here (only when the DB row is truly
// absent) keeps pre-migration behavior identical to today's, and stops
// mattering at all the instant the migration runs and a real row exists.
const CORE_FLAG_DEFAULTS: Record<string, boolean> = {
  core_dashboard: true,
  core_billing: true,
  core_customers: true,
  core_reports: true,
  core_ai_advisor: true,
  core_app_guide: true,
  core_settings: true,
  core_help_support: true,
};

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

    for (const [key, fallback] of Object.entries(CORE_FLAG_DEFAULTS)) {
      if (!(key in flags)) flags[key] = fallback;
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

/**
 * Support contact info, social links, and legal text (migration 0047) -
 * editable from /admin -> Site Content, no code change or redeploy needed.
 * Public: the footer's social icons and the pre-login Help links need this
 * before anyone signs in.
 */
configRouter.get("/site-settings", async (_req: Request, res: Response) => {
  const anonClient = getAnonClient();
  const { data, error } = await anonClient.from("site_settings").select("key, value");

  if (error) {
    // Fail open to an empty map - a missing table before migration 0047 is
    // applied must not break every page load (same reasoning throughout
    // this file).
    res.json({ data: {} });
    return;
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.key] = row.value ?? "";
  }
  res.json({ data: map });
});

/**
 * Per-key last-edited timestamps for site_settings (migration 0047),
 * public - lets an admin-editable legal page (LegalTextPage.tsx) show a
 * real "Last updated" date instead of a hardcoded one that goes stale.
 */
configRouter.get("/site-settings/updated-at", async (_req: Request, res: Response) => {
  const anonClient = getAnonClient();
  const { data, error } = await anonClient.from("site_settings").select("key, updated_at");

  if (error) {
    res.json({ data: {} });
    return;
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.key] = row.updated_at;
  }
  res.json({ data: map });
});

/**
 * Active FAQ entries (migration 0047), public - shown on the Help &
 * Support page, reachable before login too.
 */
configRouter.get("/faq", async (_req: Request, res: Response) => {
  const anonClient = getAnonClient();
  const { data, error } = await anonClient
    .from("faq_items")
    .select("id, question, answer, sort_order")
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    res.json({ data: [] });
    return;
  }

  res.json({ data: (data ?? []).map((row) => ({ id: row.id, question: row.question, answer: row.answer })) });
});
