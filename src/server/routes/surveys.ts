import { Router, type Request, type Response } from "express";
import { surveyResponseSchema } from "../validation/admin";

// Regular-user side of surveys: see active ones (and whether already
// answered), submit a response. Creating/closing a survey or reading
// aggregated results is admin-only - see src/server/routes/admin/surveys.ts.
export const surveysRouter = Router();

surveysRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data: surveys, error } = await supabase
    .from("surveys")
    .select("id, title, description, questions, created_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const { data: responses, error: responsesError } = await supabase
    .from("survey_responses")
    .select("survey_id")
    .eq("user_id", userId);

  if (responsesError) {
    res.status(400).json({ error: responsesError.message });
    return;
  }

  const answeredIds = new Set((responses ?? []).map((r) => r.survey_id));

  res.json({
    data: (surveys ?? [])
      .filter((row) => !answeredIds.has(row.id))
      .map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description ?? undefined,
        questions: row.questions,
        createdAt: row.created_at,
      })),
  });
});

surveysRouter.post("/:id/responses", async (req: Request, res: Response) => {
  const parsed = surveyResponseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { error } = await supabase
    .from("survey_responses")
    .insert({ survey_id: req.params.id, user_id: userId, answers: parsed.data.answers });

  if (error) {
    const alreadyAnswered = /duplicate key|unique constraint/i.test(error.message);
    res.status(400).json({ error: alreadyAnswered ? "You've already answered this survey." : error.message });
    return;
  }

  res.status(201).json({ message: "Thanks for your feedback!" });
});
