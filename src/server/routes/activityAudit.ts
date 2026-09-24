import { Router, type Request, type Response } from "express";
import { getServiceRoleClient, getUserScopedClient } from "../supabaseClients";
import { findUserByEmail } from "../lib/findUserByEmail";

export const activityAuditRouter = Router();

interface ActivityLogQuery {
  businessId?: string;
  userId?: string;
  actionType?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

/**
 * Logs an activity to the activity_logs table.
 * Called from activityLogging.ts middleware for every authenticated API
 * request (while the activity_monitoring_enabled flag is on).
 * Uses service-role client for writes (same pattern as notifications).
 */
export async function logActivity(
  businessId: string,
  userId: string,
  actionType: string,
  entityType: string,
  entityId?: string,
  changes?: Record<string, any>,
  request?: Request
) {
  try {
    const supabase = getServiceRoleClient();
    const ipAddress = request?.ip || request?.headers["x-forwarded-for"] || "unknown";
    const userAgent = request?.headers["user-agent"] || "unknown";

    await supabase.from("activity_logs").insert({
      business_id: businessId,
      user_id: userId,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      changes: changes || null,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (err) {
    // Silently fail - don't break API if logging fails
    console.error("[activity audit] failed to log:", err);
  }
}

/** Counts rows per distinct value of `key` - the Postgrest JS client has no
 * GROUP BY, so this reads just that one column (capped) and tallies it in
 * JS. Fine at Aziiki's current scale for a 30-day admin stats view; would
 * need a real SQL aggregate (an RPC function) if this table gets huge. */
function countBy(rows: Array<Record<string, any>>, key: string): Array<{ [k: string]: any; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = row[key] ?? "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].map(([value, count]) => ({ [key]: value, count })).sort((a, b) => b.count - a.count);
}

/**
 * GET /api/admin/activity-logs
 * Platform-wide by default (any Aziiki admin, migration 0063's RLS policy) -
 * pass ?businessId= to narrow to one business.
 */
activityAuditRouter.get("/", async (req: Request, res: Response) => {
  try {
    const query = req.query as ActivityLogQuery;
    const limit = Math.min(Number(query.limit) || 100, 1000);
    const offset = Number(query.offset) || 0;

    const supabase = getUserScopedClient(req.headers.authorization?.slice(7) || "");

    let dbQuery = supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (query.businessId) dbQuery = dbQuery.eq("business_id", query.businessId);
    if (query.userId) {
      // The filter UI asks for an email (what an admin actually knows), not
      // a raw user id - resolve it first. A userId-shaped value (already a
      // UUID) is used as-is.
      const isUuid = /^[0-9a-f-]{36}$/i.test(query.userId);
      const resolvedUserId = isUuid ? query.userId : (await findUserByEmail(query.userId))?.id;
      if (!resolvedUserId) {
        res.json({ logs: [], total: 0, limit, offset });
        return;
      }
      dbQuery = dbQuery.eq("user_id", resolvedUserId);
    }
    if (query.actionType) dbQuery = dbQuery.eq("action_type", query.actionType);
    if (query.entityType) dbQuery = dbQuery.eq("entity_type", query.entityType);
    if (query.startDate) dbQuery = dbQuery.gte("timestamp", query.startDate);
    if (query.endDate) dbQuery = dbQuery.lte("timestamp", query.endDate);

    const { data, error, count } = await dbQuery;
    if (error) throw error;

    res.json({
      logs: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[activity audit] get failed:", err);
    res.status(500).json({ error: "Failed to fetch activity logs" });
  }
});

/**
 * GET /api/admin/activity-logs/stats
 * Summary statistics for the last 30 days - platform-wide, or one business
 * with ?businessId=.
 */
activityAuditRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const { businessId } = req.query as { businessId?: string };
    const supabase = getUserScopedClient(req.headers.authorization?.slice(7) || "");
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let rowsQuery = supabase.from("activity_logs").select("action_type, entity_type", { count: "exact" }).gte("timestamp", since).limit(20_000);
    if (businessId) rowsQuery = rowsQuery.eq("business_id", businessId);
    const { data: rows, error, count: totalCount } = await rowsQuery;
    if (error) throw error;

    res.json({
      totalActions: totalCount ?? (rows?.length || 0),
      byActionType: countBy(rows || [], "action_type"),
      byEntityType: countBy(rows || [], "entity_type"),
      last30Days: true,
    });
  } catch (err) {
    console.error("[activity audit] stats failed:", err);
    res.status(500).json({ error: "Failed to fetch activity stats" });
  }
});

/**
 * GET /api/admin/activity-logs/export
 * Export activity logs as CSV for compliance - platform-wide, or one
 * business with ?businessId=.
 */
activityAuditRouter.get("/export", async (req: Request, res: Response) => {
  try {
    const { businessId, format = "csv" } = req.query as { businessId?: string; format?: "csv" | "json" };
    const supabase = getUserScopedClient(req.headers.authorization?.slice(7) || "");

    let logsQuery = supabase.from("activity_logs").select("*").order("timestamp", { ascending: false }).limit(50000);
    if (businessId) logsQuery = logsQuery.eq("business_id", businessId);
    const { data: logs, error } = await logsQuery;
    if (error) throw error;

    if (format === "json") {
      res.json(logs || []);
      return;
    }

    // CSV format
    const headers = ["ID", "Business ID", "User ID", "Action Type", "Entity Type", "Entity ID", "Timestamp", "Changes"];
    const rows = (logs || []).map((log: any) => [
      log.id,
      log.business_id,
      log.user_id,
      log.action_type,
      log.entity_type,
      log.entity_id || "",
      log.timestamp,
      log.changes ? JSON.stringify(log.changes) : "",
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((col) => `"${(col || "").toString().replace(/"/g, '""')}"`).join(",")),
    ].join("\n");

    res.header("Content-Type", "text/csv");
    res.header("Content-Disposition", `attachment; filename="activity_logs_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("[activity audit] export failed:", err);
    res.status(500).json({ error: "Failed to export activity logs" });
  }
});

/**
 * GET /api/admin/activity-logs/user-summary/:userId
 * Summary of a specific user's activity - platform-wide, or one business
 * with ?businessId=.
 */
activityAuditRouter.get("/user-summary/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { businessId } = req.query as { businessId?: string };
    const supabase = getUserScopedClient(req.headers.authorization?.slice(7) || "");

    const scoped = <T,>(q: T & { eq: (col: string, val: string) => T }) => (businessId ? q.eq("business_id", businessId) : q);

    // Last activity timestamp - maybeSingle, not single: a user with no
    // logged activity yet is a normal, expected case, not an error.
    const { data: lastActivity } = await scoped(
      supabase.from("activity_logs").select("timestamp").eq("user_id", userId).order("timestamp", { ascending: false }).limit(1) as any
    ).maybeSingle();

    const { data: actionRows } = await scoped(supabase.from("activity_logs").select("action_type").eq("user_id", userId).limit(20_000) as any);

    const { count: totalCount } = await scoped(supabase.from("activity_logs").select("*", { count: "exact", head: true }).eq("user_id", userId) as any);

    res.json({
      userId,
      totalActions: totalCount || 0,
      lastActivityAt: lastActivity?.timestamp ?? null,
      actionTypeDistribution: countBy(actionRows || [], "action_type"),
    });
  } catch (err) {
    console.error("[activity audit] user summary failed:", err);
    res.status(500).json({ error: "Failed to fetch user summary" });
  }
});
