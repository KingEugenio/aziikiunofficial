// Triggered on a schedule by Vercel Cron (see the "crons" entry in
// vercel.json), same pattern as api/cron/overdue-sweep.ts. Unlike Redis's
// PEXPIRE, an expired row in rate_limit_counters doesn't disappear on its
// own - it just stops mattering to rate_limit_increment. Without this,
// the table would grow forever (one row per unique key ever seen: every
// IP+email combo, every guest IP, etc).
import type { Request, Response } from "express";
import { getServiceRoleClient } from "../../server/supabaseClients";

export default async function handler(req: Request, res: Response) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!expected) {
    console.error("[cron/rate-limit-cleanup] CRON_SECRET is not set - refusing to run.");
    res.status(500).json({ error: "Server misconfigured." });
    return;
  }

  if (provided !== expected) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.rpc("rate_limit_cleanup_expired");
    if (error) throw error;
    res.status(200).json({ ok: true, deleted: data ?? 0 });
  } catch (err) {
    console.error("[cron/rate-limit-cleanup] failed:", err);
    res.status(500).json({ error: "Cleanup failed." });
  }
}
