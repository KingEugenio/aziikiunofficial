import { Router, type Request, type Response } from "express";

export const adminUsersRouter = Router();

// Makes accounts actually browsable/searchable from the admin portal -
// before this, the only way to act on a specific account was
// PaymentsPanel's "manually set a plan" form, which needs the exact email
// typed in blind. This is read-only; the tier change itself still goes
// through the existing PUT /admin/subscription-plans/users/:email/tier
// (src/server/routes/admin/subscriptionPlans.ts) so there's exactly one
// place that logic lives.
adminUsersRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const [{ data: profiles, error: profilesError }, { data: businesses, error: businessesError }] = await Promise.all([
    supabase.from("profiles").select("id, email, tier, is_admin, created_at").order("created_at", { ascending: false }).limit(500),
    // Personal Workspace rows (is_personal = true) are created automatically
    // for every account and aren't something a user "added" - excluded so
    // the count reflects real business profiles only, same convention as
    // businessLimits.ts's per-tier cap.
    supabase.from("businesses").select("user_id").eq("is_personal", false),
  ]);

  if (profilesError) {
    res.status(400).json({ error: profilesError.message });
    return;
  }
  if (businessesError) {
    res.status(400).json({ error: businessesError.message });
    return;
  }

  const businessCounts = new Map<string, number>();
  for (const row of businesses ?? []) {
    businessCounts.set(row.user_id, (businessCounts.get(row.user_id) ?? 0) + 1);
  }

  res.json({
    data: (profiles ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      tier: row.tier,
      isAdmin: row.is_admin,
      createdAt: row.created_at,
      businessCount: businessCounts.get(row.id) ?? 0,
    })),
  });
});
