import { Router, type Request, type Response } from "express";

export const adminFeedbackRouter = Router();

function fromRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    message: row.message,
    createdAt: row.created_at,
  };
}

// Read-only: feedback_submissions (migration 0014) only ever gets written
// to by the caller's own POST /api/feedback (src/server/routes/feedback.ts) -
// there's nothing for an admin to create, edit, or delete here, just a
// list to actually read what's been submitted (see migration 0051 for the
// admin select policy this route depends on).
adminFeedbackRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("feedback_submissions")
    .select("id, name, email, message, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: (data ?? []).map(fromRow) });
});
