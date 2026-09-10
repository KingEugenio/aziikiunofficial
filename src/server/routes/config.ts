import { Router, type Request, type Response } from "express";
import { isEmailConfigured } from "../email/resendClient";
import { isPaystackConfigured } from "../payments/paystackClient";
import { getAnonClient, getUserScopedClient } from "../supabaseClients";
import { env } from "../env";

/**
 * Public, non-sensitive feature flags the frontend needs before a user is
 * even signed in (e.g. to disable a button rather than let them click it
 * and hit a 503). Never expose actual secret values here.
 *
 * `flags` is the computed, per-caller feature-flag set (see migration 0032):
 * every feature_flags.enabled_default, with the caller's own
 * user_feature_overrides layered on top when they're signed in. Anonymous
 * callers (not signed in yet) just get the global defaults - there's no
 * override to apply. This is deliberately mounted as a public route (see
 * app.ts) rather than under requireAuth so the pre-login screens (auth
 * method choice, onboarding) can read it too.
 */
export const configRouter = Router();

configRouter.get("/features", async (req: Request, res: Response) => {
  // Deliberately never lets a feature-flags read failure take down this
  // whole endpoint - emailSendingEnabled/paystackEnabled are load-bearing
  // for the pre-login screens regardless of whether the flags tables (or
  // their migration) are in place yet, so any error here degrades to "no
  // flags" (everything gated off) rather than a 500/400.
  const flags: Record<string, boolean> = {};
  try {
    const anonClient = getAnonClient();
    const { data: flagRows, error: flagsError } = await anonClient.from("feature_flags").select("key, enabled_default");
    if (flagsError) throw flagsError;
    for (const row of flagRows ?? []) {
      flags[row.key] = row.enabled_default;
    }

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length).trim();
      if (token) {
        const userClient = getUserScopedClient(token);
        const { data: userData } = await userClient.auth.getUser(token);
        if (userData?.user) {
          const { data: overrides } = await userClient
            .from("user_feature_overrides")
            .select("flag_key, enabled")
            .eq("user_id", userData.user.id);
          for (const row of overrides ?? []) {
            flags[row.flag_key] = row.enabled;
          }
        }
      }
    }
  } catch (err) {
    console.error("[config/features] failed to load feature flags:", err);
  }

  res.json({ emailSendingEnabled: isEmailConfigured(), paystackEnabled: isPaystackConfigured(), flags });
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
