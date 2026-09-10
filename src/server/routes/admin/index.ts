import { Router, type Request, type Response } from "express";
import { adminFeatureFlagsRouter } from "./featureFlags";
import { adminAnnouncementsRouter } from "./announcements";
import { adminSurveysRouter } from "./surveys";
import { adminAssetsRouter } from "./assets";
import { adminStatsRouter } from "./stats";

export const adminRouter = Router();

// Confirms admin access and returns just enough identity for the portal's
// header - requireAdmin (mounted in app.ts) has already rejected anyone
// who isn't, so reaching this handler at all IS the "you're an admin" signal.
adminRouter.get("/me", (req: Request, res: Response) => {
  res.json({ data: { id: req.user!.id, email: req.user!.email } });
});

adminRouter.use("/feature-flags", adminFeatureFlagsRouter);
adminRouter.use("/announcements", adminAnnouncementsRouter);
adminRouter.use("/surveys", adminSurveysRouter);
adminRouter.use("/assets", adminAssetsRouter);
adminRouter.use("/stats", adminStatsRouter);
