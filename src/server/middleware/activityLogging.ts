import type { Request, Response, NextFunction } from "express";
import { logActivity } from "../routes/activityAudit";

/**
 * Middleware to log all API activity to the activity_logs table.
 * Only logs authenticated requests (req.user is set).
 * Determines action type from HTTP method and route.
 */
export function activityLoggingMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    let statusCode = res.statusCode;

    // Capture the status code when json() is called
    res.json = function (data: any) {
      statusCode = res.statusCode;
      return originalJson.call(this, data);
    };

    // Capture the status code when send() is called
    const originalSend = res.send;
    res.send = function (data: any) {
      statusCode = res.statusCode;
      return originalSend.call(this, data);
    };

    // Only log successful requests from authenticated users
    res.on("finish", async () => {
      // Skip logging for public endpoints and unsuccessful requests
      if (!req.user || statusCode >= 400 || req.path.startsWith("/api/config") || req.path.startsWith("/api/announcements/public")) {
        return;
      }

      try {
        const userId = (req.user as any).id || (req.user as any).sub;
        if (!userId) return;

        // Extract business_id from request (usually in body or params)
        let businessId: string | undefined;
        if (req.body?.business_id) businessId = req.body.business_id;
        else if (req.body?.businessId) businessId = req.body.businessId;
        else if (req.params.businessId) businessId = req.params.businessId;
        else if (req.query.businessId) businessId = req.query.businessId as string;

        if (!businessId) return; // Skip if we can't determine business

        // Determine action type from HTTP method
        let actionType = "read";
        if (req.method === "POST") actionType = "create";
        else if (req.method === "PUT") actionType = "update";
        else if (req.method === "PATCH") actionType = "update";
        else if (req.method === "DELETE") actionType = "delete";

        // Extract entity type from route
        const pathParts = req.path.split("/").filter(Boolean);
        let entityType = "unknown";
        if (pathParts.length > 1) {
          entityType = pathParts[1]; // e.g., "invoices", "customers", "receipts"
        }

        // Extract entity ID from body or params
        let entityId: string | undefined;
        if (req.body?.id) entityId = req.body.id;
        else if (req.params.id) entityId = req.params.id;

        // For POST requests, capture created changes
        let changes: Record<string, any> | undefined;
        if (actionType === "create" && req.body) {
          changes = { created: req.body };
        } else if ((actionType === "update" || actionType === "delete") && req.body) {
          changes = { modified: req.body };
        }

        await logActivity(businessId, userId, actionType, entityType, entityId, changes, req);
      } catch (err) {
        console.error("[activity logging middleware] error:", err);
        // Don't rethrow - middleware should never break the response
      }
    });

    next();
  };
}
