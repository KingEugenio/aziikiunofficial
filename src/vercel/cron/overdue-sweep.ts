// Triggered on a schedule by Vercel Cron (see the "crons" entry in
// vercel.json), NOT by any user action. This replaces the setInterval loop
// that runs inside server.ts's long-lived process locally / on Render -
// that timer approach doesn't work on Vercel because a serverless function
// only executes while handling a request and is frozen (or killed)
// otherwise, so nothing would ever fire it.
//
// Vercel automatically sends an Authorization: Bearer <CRON_SECRET> header
// on cron-triggered requests when CRON_SECRET is set as a project env var,
// which is what the check below verifies - this stops anyone who finds this
// URL from being able to trigger it manually.
import type { Request, Response } from "express";
import { runOverdueInvoiceSweep } from "../../server/notifications/overdueInvoiceSweep";

export default async function handler(req: Request, res: Response) {
  const expected = process.env.CRON_SECRET;
  const provided = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!expected) {
    console.error("[cron/overdue-sweep] CRON_SECRET is not set - refusing to run.");
    res.status(500).json({ error: "Server misconfigured." });
    return;
  }

  if (provided !== expected) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  try {
    await runOverdueInvoiceSweep();
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[cron/overdue-sweep] failed:", err);
    res.status(500).json({ error: "Sweep failed." });
  }
}
