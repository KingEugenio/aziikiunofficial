import { Router, type Request, type Response } from "express";
import { getAnonClient } from "../supabaseClients";

// Regular-user side of admin_announcements: read active ones, mark read.
// Writing/deactivating an announcement is an admin-only action - see
// src/server/routes/admin/announcements.ts.
export const announcementsRouter = Router();

announcementsRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data: announcements, error } = await supabase
    .from("admin_announcements")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const { data: reads, error: readsError } = await supabase
    .from("admin_announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId);

  if (readsError) {
    res.status(400).json({ error: readsError.message });
    return;
  }

  const readIds = new Set((reads ?? []).map((r) => r.announcement_id));

  // Tier + activity targeting (migration 0046): resolved once per request
  // and applied here rather than trusting the client to filter, since the
  // whole point is a user shouldn't even see an announcement not meant for
  // their audience. Both default to "all" in the DB, so most rows never
  // even reach these checks.
  const needsTierOrActivity = (announcements ?? []).some((r) => r.target_tier !== "all" || r.target_activity !== "all");
  let callerTier = "basic";
  let callerTransactionCount = 0;
  if (needsTierOrActivity) {
    const { data: profileRow } = await supabase.from("profiles").select("tier").eq("id", userId).maybeSingle();
    if (profileRow?.tier) callerTier = profileRow.tier;
    const { count } = await supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", userId);
    callerTransactionCount = count ?? 0;
  }

  const matchesActivity = (target: string) =>
    target === "all" || (target === "new" && callerTransactionCount === 0) || (target === "active" && callerTransactionCount >= 5);

  res.json({
    data: (announcements ?? [])
      .filter((row) => (row.target_tier === "all" || row.target_tier === callerTier) && matchesActivity(row.target_activity))
      .map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        targetScreen: row.target_screen,
        createdAt: row.created_at,
        read: readIds.has(row.id),
      })),
  });
});

// Unauthenticated variant for the sign-in/sign-up screen - same RLS policy
// (active announcements are readable by anyone) but no per-user read
// tracking, since there's no user yet. The client dismisses these locally
// (localStorage) instead of via a server-side "mark read". Deliberately its
// own router (not a route on announcementsRouter) - that router is mounted
// behind requireAuth in app.ts, and this one has to work before sign-in.
export const publicAnnouncementsRouter = Router();

publicAnnouncementsRouter.get("/", async (_req: Request, res: Response) => {
  const supabase = getAnonClient();

  const { data: announcements, error } = await supabase
    .from("admin_announcements")
    .select("*")
    .eq("is_active", true)
    .in("target_screen", ["all", "auth_signin", "auth_signup"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({
    data: (announcements ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      targetScreen: row.target_screen,
      createdAt: row.created_at,
    })),
  });
});

announcementsRouter.post("/:id/read", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { error } = await supabase
    .from("admin_announcement_reads")
    .upsert({ announcement_id: req.params.id, user_id: userId }, { onConflict: "announcement_id,user_id" });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(204).send();
});
