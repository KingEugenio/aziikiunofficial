import { Router, type Request, type Response } from "express";
import { z } from "zod";

// The signed-in user's own account-level settings (not a business, not
// admin) - currently just the marketing-email opt-in (migration 0047).
// Order/payment/shipment notifications (notification_log) are separate
// and always send regardless of this.
export const profileRouter = Router();

profileRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("profiles")
    .select("marketing_emails_enabled")
    .eq("id", req.user!.id)
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: { marketingEmailsEnabled: data?.marketing_emails_enabled ?? false } });
});

const updateSchema = z.object({
  marketingEmailsEnabled: z.boolean(),
});

profileRouter.patch("/", async (req: Request, res: Response) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { error } = await supabase
    .from("profiles")
    .update({ marketing_emails_enabled: parsed.data.marketingEmailsEnabled })
    .eq("id", req.user!.id);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: { marketingEmailsEnabled: parsed.data.marketingEmailsEnabled } });
});
