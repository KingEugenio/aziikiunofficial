import { Router, type Request, type Response } from "express";

export const adminAnalyticsRouter = Router();

/**
 * "Which features do people use most" for the admin portal - aggregates
 * analytics_events (migration 0018/0057) by event_name over a trailing
 * window (default 30 days, capped at 90 to keep the row scan bounded).
 *
 * Aggregated in JS from a capped raw select rather than a Postgres RPC
 * function: at this app's current event volume a GROUP BY function would
 * be premature - if this table's row count ever makes the 20k-row cap
 * below start truncating real data, that's the signal to add one instead
 * of guessing now.
 */
adminAnalyticsRouter.get("/feature-usage", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const requestedDays = Number(req.query.days);
  const days = Number.isFinite(requestedDays) && requestedDays > 0 ? Math.min(requestedDays, 90) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("analytics_events")
    .select("event_name, event_category")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20_000);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const counts = new Map<string, { eventCategory: string; count: number }>();
  for (const row of data ?? []) {
    const existing = counts.get(row.event_name);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(row.event_name, { eventCategory: row.event_category, count: 1 });
    }
  }

  const ranked = Array.from(counts.entries())
    .map(([eventName, { eventCategory, count }]) => ({ eventName, eventCategory, count }))
    .sort((a, b) => b.count - a.count);

  res.json({ data: ranked, totalEvents: data?.length ?? 0, windowDays: days });
});
