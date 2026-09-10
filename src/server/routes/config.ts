import { Router, type Request, type Response } from "express";
import { isEmailConfigured } from "../email/resendClient";
import { isPaystackConfigured } from "../payments/paystackClient";

export const configRouter = Router();

/**
 * Public, non-sensitive feature flags the frontend needs before a user is
 * even signed in (e.g. to disable a button rather than let them click it
 * and hit a 503). Never expose actual secret values here.
 */
configRouter.get("/features", (_req: Request, res: Response) => {
  res.json({ emailSendingEnabled: isEmailConfigured(), paystackEnabled: isPaystackConfigured() });
});
