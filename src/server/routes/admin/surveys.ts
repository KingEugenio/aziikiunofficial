import { Router, type Request, type Response } from "express";
import { surveyCreateSchema } from "../../validation/admin";

export const adminSurveysRouter = Router();

function fromRow(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    questions: row.questions,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

adminSurveysRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const { data: surveys, error } = await supabase.from("surveys").select("*").order("created_at", { ascending: false });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const { data: responses, error: responsesError } = await supabase.from("survey_responses").select("survey_id");

  if (responsesError) {
    res.status(400).json({ error: responsesError.message });
    return;
  }

  const responseCounts = new Map<string, number>();
  for (const row of responses ?? []) {
    responseCounts.set(row.survey_id, (responseCounts.get(row.survey_id) ?? 0) + 1);
  }

  res.json({ data: (surveys ?? []).map((row) => ({ ...fromRow(row), responseCount: responseCounts.get(row.id) ?? 0 })) });
});

adminSurveysRouter.post("/", async (req: Request, res: Response) => {
  const parsed = surveyCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("surveys")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      questions: parsed.data.questions,
      created_by: req.user!.id,
    })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ data: fromRow(data) });
});

adminSurveysRouter.patch("/:id", async (req: Request, res: Response) => {
  const isActive = typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined;
  if (isActive === undefined) {
    res.status(400).json({ error: "isActive (boolean) is required." });
    return;
  }

  const supabase = req.supabase!;
  const { data, error } = await supabase
    .from("surveys")
    .update({ is_active: isActive })
    .eq("id", req.params.id)
    .select("*")
    .maybeSingle();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ data: fromRow(data) });
});

// Per-question breakdown: option -> count for "choice" questions, the raw
// list of answers for "text" questions (there's no useful way to aggregate
// free text beyond reading it).
adminSurveysRouter.get("/:id/results", async (req: Request, res: Response) => {
  const supabase = req.supabase!;

  const { data: survey, error: surveyError } = await supabase.from("surveys").select("*").eq("id", req.params.id).maybeSingle();

  if (surveyError) {
    res.status(400).json({ error: surveyError.message });
    return;
  }
  if (!survey) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const { data: responses, error: responsesError } = await supabase
    .from("survey_responses")
    .select("answers, created_at")
    .eq("survey_id", req.params.id);

  if (responsesError) {
    res.status(400).json({ error: responsesError.message });
    return;
  }

  const questions = (survey.questions ?? []) as Array<{ id: string; type: "text" | "choice"; prompt: string; options?: string[] }>;

  const perQuestion = questions.map((q) => {
    const answers = (responses ?? []).map((r) => (r.answers as Record<string, string>)?.[q.id]).filter(Boolean) as string[];
    if (q.type === "choice") {
      const counts: Record<string, number> = {};
      for (const option of q.options ?? []) counts[option] = 0;
      for (const answer of answers) counts[answer] = (counts[answer] ?? 0) + 1;
      return { id: q.id, prompt: q.prompt, type: q.type, counts };
    }
    return { id: q.id, prompt: q.prompt, type: q.type, answers };
  });

  res.json({ data: { survey: fromRow(survey), responseCount: (responses ?? []).length, questions: perQuestion } });
});
