import { Router, type Request, type Response } from "express";
import { isEmailConfigured } from "../email/resendClient";
import { isPaystackConfigured } from "../payments/paystackClient";
import { getAnonClient, getUserScopedClient } from "../supabaseClients";

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
