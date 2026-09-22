import { Router, type Request, type Response } from "express";
import { getServiceRoleClient, getUserScopedClient } from "../supabaseClients";
import type { SupabaseClient } from "@supabase/supabase-js";

export const activityAuditRouter = Router();

interface ActivityLogQuery {
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
 * Called from middleware for all API operations.
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

/**
 * GET /api/admin/activity-logs
 * Fetch activity logs for the business with filtering, sorting, and pagination.
 * Only accessible to business owners/admins.
 */
activityAuditRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { businessId } = req.query as { businessId?: string };
    if (!businessId) return res.status(400).json({ error: "businessId required" });

    const query = req.query as ActivityLogQuery;
    const limit = Math.min(Number(query.limit) || 100, 1000);
    const offset = Number(query.offset) || 0;

    const supabase = getUserScopedClient(req.headers.authorization?.slice(7) || "");

    let dbQuery = supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("business_id", businessId)
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (query.userId) dbQuery = dbQuery.eq("user_id", query.userId);
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
 * Summary statistics for activity (daily/weekly/monthly counts).
 */
activityAuditRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const { businessId, period = "day" } = req.query as { businessId?: string; period?: "day" | "week" | "month" };
    if (!businessId) return res.status(400).json({ error: "businessId required" });

    const supabase = getUserScopedClient(req.headers.authorization?.slice(7) || "");

    // Get aggregated stats by action type
    const { data: byAction, error: actionError } = await supabase
      .from("activity_logs")
      .select("action_type, count(id)")
      .eq("business_id", businessId)
      .gte("timestamp", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .group_by("action_type");

    if (actionError) throw actionError;

    // Get aggregated stats by entity type
    const { data: byEntity } = await supabase
      .from("activity_logs")
      .select("entity_type, count(id)")
      .eq("business_id", businessId)
      .gte("timestamp", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .group_by("entity_type");

    // Get total count
    const { count: totalCount } = await supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("business_id", businessId);

    res.json({
      totalActions: totalCount || 0,
      byActionType: byAction || [],
      byEntityType: byEntity || [],
      period,
      last30Days: true,
    });
  } catch (err) {
    console.error("[activity audit] stats failed:", err);
    res.status(500).json({ error: "Failed to fetch activity stats" });
  }
});

/**
 * GET /api/admin/activity-logs/export
 * Export activity logs as CSV for compliance.
 */
activityAuditRouter.get("/export", async (req: Request, res: Response) => {
  try {
    const { businessId, format = "csv" } = req.query as { businessId?: string; format?: "csv" | "json" };
    if (!businessId) return res.status(400).json({ error: "businessId required" });

    const supabase = getUserScopedClient(req.headers.authorization?.slice(7) || "");

    const { data: logs, error } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("business_id", businessId)
      .order("timestamp", { ascending: false })
      .limit(50000);

    if (error) throw error;

    if (format === "json") {
      res.json(logs || []);
      return;
    }

    // CSV format
    const headers = ["ID", "User ID", "Action Type", "Entity Type", "Entity ID", "Timestamp", "Changes"];
    const rows = (logs || []).map((log: any) => [
      log.id,
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
    res.header("Content-Disposition", `attachment; filename="activity_logs_${businessId}_${Date.now()}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error("[activity audit] export failed:", err);
    res.status(500).json({ error: "Failed to export activity logs" });
  }
});

/**
 * GET /api/admin/activity-logs/user-summary/:userId
 * Summary of a specific user's activity across all actions.
 */
activityAuditRouter.get("/user-summary/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { businessId } = req.query as { businessId?: string };
    if (!businessId) return res.status(400).json({ error: "businessId required" });

    const supabase = getUserScopedClient(req.headers.authorization?.slice(7) || "");

    // Get last activity timestamp
    const { data: lastActivity } = await supabase
      .from("activity_logs")
      .select("timestamp")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .single();

    // Get total actions by type
    const { data: actionCounts } = await supabase
      .from("activity_logs")
      .select("action_type, count(id)")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .group_by("action_type");

    // Get total activity count
    const { count: totalCount } = await supabase
      .from("activity_logs")
      .select("*", { count: "exact" })
      .eq("business_id", businessId)
      .eq("user_id", userId);

    res.json({
      userId,
      totalActions: totalCount || 0,
      lastActivityAt: lastActivity?.timestamp,
      actionTypeDistribution: actionCounts || [],
    });
  } catch (err) {
    console.error("[activity audit] user summary failed:", err);
    res.status(500).json({ error: "Failed to fetch user summary" });
  }
});
