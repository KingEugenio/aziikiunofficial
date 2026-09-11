import { Router, type Request, type Response } from "express";
import { requireSection } from "../../middleware/requireAdmin";
import { adminFeatureFlagsRouter } from "./featureFlags";
import { adminAnnouncementsRouter } from "./announcements";
import { adminSurveysRouter } from "./surveys";
import { adminAssetsRouter } from "./assets";
import { adminStatsRouter } from "./stats";
import { adminSubscriptionPlansRouter } from "./subscriptionPlans";
import { adminGuideItemsRouter } from "./guideItems";
import { adminAdminsRouter } from "./admins";
import { adminSiteSettingsRouter } from "./siteSettings";
import { adminFaqItemsRouter } from "./faqItems";

export const adminRouter = Router();

const ALL_SECTIONS = ["dashboard", "flags", "announcements", "surveys", "payments", "branding", "content", "guides", "admins"];

// Confirms admin access and returns just enough identity + permissions for
// the portal's header/nav to filter itself - requireAdmin (mounted in
// app.ts) has already rejected anyone who isn't at least some kind of
// admin, and has already loaded isSuperAdmin/adminSections onto req.
adminRouter.get("/me", (req: Request, res: Response) => {
  res.json({
    data: {
      id: req.user!.id,
      email: req.user!.email,
      isSuperAdmin: Boolean(req.isSuperAdmin),
      sections: req.isSuperAdmin ? ALL_SECTIONS : req.adminSections ?? [],
    },
  });
});

adminRouter.use("/feature-flags", requireSection("flags"), adminFeatureFlagsRouter);
adminRouter.use("/announcements", requireSection("announcements"), adminAnnouncementsRouter);
adminRouter.use("/surveys", requireSection("surveys"), adminSurveysRouter);
adminRouter.use("/assets", requireSection("branding"), adminAssetsRouter);
adminRouter.use("/stats", requireSection("dashboard"), adminStatsRouter);
adminRouter.use("/subscription-plans", requireSection("payments"), adminSubscriptionPlansRouter);
adminRouter.use("/guide-items", requireSection("guides"), adminGuideItemsRouter);
adminRouter.use("/site-settings", requireSection("content"), adminSiteSettingsRouter);
adminRouter.use("/faq-items", requireSection("content"), adminFaqItemsRouter);
// Managing other admins is always superadmin-only, enforced inside
// adminAdminsRouter itself (not via requireSection) - granting the
// "admins" section to a regular admin isn't even possible from the UI,
// but the server never trusts that alone anyway.
adminRouter.use("/admins", adminAdminsRouter);
