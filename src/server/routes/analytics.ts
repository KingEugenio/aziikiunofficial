import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { getServiceRoleClient } from "../supabaseClients";

// Matches analytics_events.event_category's check constraint exactly
// (migration 0018) - kept in sync by hand since Postgres enums/check
// constraints aren't introspectable from here at build time.
const EVENT_CATEGORIES = [
  "navigation",
  "document",
  "template",
  "engagement",
  "onboarding",
  "error",
  "performance",
  "sharing",
  "sync",
] as const;

const eventSchema = z.object({
  eventName: z.string().min(1).max(100),
  eventCategory: z.enum(EVENT_CATEGORIES),
  sessionId: z.string().min(1).max(100),
  businessId: z.string().uuid().optional(),
  properties: z.record(z.unknown()).optional(),
});

export const analyticsRouter = Router();

/**
 * Writes to analytics_events exclusively through the service-role client
 * (migration 0018's original design: no insert RLS policy exists for
 * authenticated/anon callers) so a client can only ever attribute an event
 * to its own authenticated user - req.user!.id, never a client-supplied
 * value - while still keeping the table itself locked down against direct
 * writes from anywhere else.
 */
analyticsRouter.post("/events", async (req: Request, res: Response) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    // Malformed analytics payload is never worth failing the request over -
    // same fail-open convention as every other optional integration in this
    // codebase (see env.ts). Still 204s so the client doesn't retry forever.
    res.status(204).end();
    return;
  }

  try {
    await getServiceRoleClient()
      .from("analytics_events")
      .insert({
        user_id: req.user!.id,
        business_id: parsed.data.businessId ?? null,
        session_id: parsed.data.sessionId,
        event_name: parsed.data.eventName,
        event_category: parsed.data.eventCategory,
        properties: parsed.data.properties ?? {},
      });
  } catch (err) {
    console.error("[analytics] failed to log event:", err);
  }

  // Always 204 regardless of outcome - an analytics write must never surface
  // as a visible error for the feature it's silently describing.
  res.status(204).end();
});
