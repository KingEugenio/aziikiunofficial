import { Router, type Request, type Response } from "express";

export const adminStatsRouter = Router();

// Headline counts for the admin dashboard home screen. Each is a plain
// count query (head: true, count: "exact") - cheap, and there's no need
// for the actual rows here, just the totals.
adminStatsRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const [users, businesses, activeAnnouncements, activeSurveys, flags] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("businesses").select("id", { count: "exact", head: true }),
    supabase.from("admin_announcements").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("surveys").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("feature_flags").select("key", { count: "exact", head: true }).eq("enabled_default", true),
  ]);

  const firstError = [users, businesses, activeAnnouncements, activeSurveys, flags].find((r) => r.error)?.error;
  if (firstError) {
    res.status(400).json({ error: firstError.message });
    return;
  }

  res.json({
    data: {
      totalUsers: users.count ?? 0,
      totalBusinesses: businesses.count ?? 0,
      activeAnnouncements: activeAnnouncements.count ?? 0,
      activeSurveys: activeSurveys.count ?? 0,
      flagsEnabled: flags.count ?? 0,
    },
  });
});
