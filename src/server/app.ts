// Builds and returns the fully-configured Express app: security headers,
// rate limiting, and every /api route mounted. Deliberately contains NO
// app.listen(), no Vite dev middleware, and no static-file serving — those
// differ between environments (a long-running Node process for local dev /
// Render / Railway, vs. a Vercel serverless function where static files are
// served by Vercel's CDN instead of Express). server.ts and api/index.ts
// both call this function so the actual route/middleware wiring is defined
// in exactly one place and can never drift between environments.
import express from "express";
import helmet from "helmet";
import "express-async-errors";

import { env } from "./env";
import { initSentry, setupSentryErrorHandler } from "./sentry";
import { apiLimiter, paystackWebhookLimiter } from "./rateLimiters";
import { activityLoggingMiddleware } from "./middleware/activityLogging";
import { requireAuth } from "./middleware/requireAuth";
import { requireAdmin } from "./middleware/requireAdmin";

import { authRouter } from "./routes/auth";
import { geminiRouter } from "./routes/gemini";
import { syncRouter } from "./routes/sync";
import { businessesRouter } from "./routes/businesses";
import { enforceBusinessLimits } from "./routes/businessLimits";
import {
  businessPartnersRouter,
  businessShareholdersRouter,
  businessRolesRouter,
  businessAuditLogsRouter,
} from "./routes/businessChildren";
import { personalAccountsRouter, personalBudgetsRouter } from "./routes/personal";
import { customersRouter } from "./routes/customers";
import { enforceCustomerLimits } from "./routes/customerLimits";
import { transactionsRouter } from "./routes/transactions";
import { invoicesRouter } from "./routes/invoices";
import { receiptsRouter } from "./routes/receipts";
import { quotationsRouter } from "./routes/quotations";
import { purchaseOrdersRouter } from "./routes/purchaseOrders";
import { investmentsRouter } from "./routes/investments";
import { assetsRouter } from "./routes/assets";
import { goalsRouter } from "./routes/goals";
import { debtsRouter } from "./routes/debts";
import { inventoryRouter } from "./routes/inventory";
import { feedbackRouter } from "./routes/feedback";
import { analyticsRouter } from "./routes/analytics";
import { configRouter } from "./routes/config";
import { brandKitsRouter } from "./routes/brandKits";
import { documentTemplatesRouter } from "./routes/documentTemplates";
import { documentNumberingRouter } from "./routes/documentNumbering";
import { documentChangeLogRouter } from "./routes/documentChangeLog";
import { paymentsWebhookRouter } from "./routes/paymentsWebhook";
import { notificationsRouter } from "./routes/notifications";
import { gameSessionsRouter } from "./routes/gameSessions";
import { gameScoresRouter } from "./routes/gameScores";
import { profileRouter } from "./routes/profile";
import { signaturesRouter } from "./routes/signatures";
import { businessMembershipsRouter } from "./routes/businessMemberships";
import { announcementsRouter, publicAnnouncementsRouter } from "./routes/announcements";
import { surveysRouter } from "./routes/surveys";
import { adminRouter } from "./routes/admin";
import { activityAuditRouter } from "./routes/activityAudit";

export function createApp(): express.Express {
  // Called first, before any middleware/route is registered - no-ops
  // entirely if SENTRY_DSN is unset (see sentry.ts).
  initSentry();

  const app = express();

  app.set("trust proxy", 1); // required for correct req.ip behind Vercel/Render/any reverse proxy

  // See server.ts's original comment for the full directive-by-directive
  // rationale — unchanged from before, just relocated. Only applied in
  // production; local dev (and Vercel preview, which also runs with
  // NODE_ENV=production by default — see vercel.json note) needs this to
  // actually match what the Supabase project's URL is.
  const supabaseHttpsOrigin = env.SUPABASE_URL;
  const supabaseWssOrigin = env.SUPABASE_URL.replace(/^https:/, "wss:");

  app.use(
    helmet({
      contentSecurityPolicy:
        env.NODE_ENV === "production"
          ? {
              directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                fontSrc: ["'self'", "data:"],
                imgSrc: ["'self'", "data:", "blob:"],
                connectSrc: ["'self'", supabaseHttpsOrigin, supabaseWssOrigin, "https://*.ingest.sentry.io", "https://*.ingest.us.sentry.io", "https://*.i.posthog.com"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: [],
              },
            }
          : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  // Mounted BEFORE express.json(): Paystack webhook signature verification
  // needs the exact raw, unparsed request bytes.
  app.use("/api/payments/paystack/webhook", paystackWebhookLimiter, paymentsWebhookRouter);

  app.use(express.json({ limit: "2mb" }));

  app.use("/api/", apiLimiter);

  // ---------------------------------------------------------------------
  // Public (no session required) routes
  // ---------------------------------------------------------------------
  app.use("/api/auth", authRouter);
  app.use("/api/gemini", geminiRouter);
  app.use("/api/config", configRouter);
  app.use("/api/announcements/public", publicAnnouncementsRouter);

  // ---------------------------------------------------------------------
  // Everything below requires a valid Supabase session.
  // ---------------------------------------------------------------------
  // No requireAuth here on purpose: every route below already enforces its
  // own auth, and by the time this middleware's res.on("finish") callback
  // reads req.user, that per-route requireAuth has already set it. Checking
  // the token a second time here would just be wasted work on every request.
  app.use("/api/", activityLoggingMiddleware());
  app.use("/api/sync", requireAuth, syncRouter);
  app.use("/api/businesses", requireAuth, enforceBusinessLimits, businessesRouter);
  app.use("/api/business-partners", requireAuth, businessPartnersRouter);
  app.use("/api/business-shareholders", requireAuth, businessShareholdersRouter);
  app.use("/api/business-roles", requireAuth, businessRolesRouter);
  app.use("/api/business-audit-logs", requireAuth, businessAuditLogsRouter);
  app.use("/api/personal-accounts", requireAuth, personalAccountsRouter);
  app.use("/api/personal-budgets", requireAuth, personalBudgetsRouter);
  app.use("/api/customers", requireAuth, enforceCustomerLimits, customersRouter);
  app.use("/api/transactions", requireAuth, transactionsRouter);
  app.use("/api/invoices", requireAuth, invoicesRouter);
  app.use("/api/receipts", requireAuth, receiptsRouter);
  app.use("/api/quotations", requireAuth, quotationsRouter);
  app.use("/api/purchase-orders", requireAuth, purchaseOrdersRouter);
  app.use("/api/investments", requireAuth, investmentsRouter);
  app.use("/api/assets", requireAuth, assetsRouter);
  app.use("/api/goals", requireAuth, goalsRouter);
  app.use("/api/debts", requireAuth, debtsRouter);
  app.use("/api/inventory", requireAuth, inventoryRouter);
  app.use("/api/feedback", requireAuth, feedbackRouter);
  app.use("/api/analytics", requireAuth, analyticsRouter);
  app.use("/api/brand-kits", requireAuth, brandKitsRouter);
  app.use("/api/document-templates", requireAuth, documentTemplatesRouter);
  app.use("/api/document-numbering", requireAuth, documentNumberingRouter);
  app.use("/api/document-change-log", requireAuth, documentChangeLogRouter);
  app.use("/api/notifications", requireAuth, notificationsRouter);
  // Money Quiz (src/components/MoneyGame.tsx), the scenario-based financial
  // literacy game behind the money_game_feature flag.
  app.use("/api/game-sessions", requireAuth, gameSessionsRouter);
  app.use("/api/game-scores", requireAuth, gameScoresRouter);
  app.use("/api/profile", requireAuth, profileRouter);
  app.use("/api/signatures", requireAuth, signaturesRouter);
  app.use("/api/business-memberships", requireAuth, businessMembershipsRouter);
  app.use("/api/announcements", requireAuth, announcementsRouter);
  app.use("/api/surveys", requireAuth, surveysRouter);
  app.use("/api/admin/activity-logs", requireAuth, requireAdmin, activityAuditRouter);

  // ---------------------------------------------------------------------
  // Admin portal routes - requireAuth then requireAdmin (profiles.is_admin,
  // migration 0031). See src/admin/AdminApp.tsx for the portal itself.
  // ---------------------------------------------------------------------
  app.use("/api/admin", requireAuth, requireAdmin, adminRouter);

  // Must run after every route but before the app's own final error
  // handler below - see sentry.ts. No-ops entirely if SENTRY_DSN is unset.
  setupSentryErrorHandler(app);

  // Final error-handling middleware (must be registered last, and must take
  // 4 arguments for Express to recognize it as an error handler).
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[unhandled route error]", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Something went wrong on our end. Please try again shortly." });
  });

  return app;
}
