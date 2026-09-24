import { Router, type Request, type Response } from "express";
import { gameScoreCreateSchema } from "../validation/moneyQuiz";

export const gameScoresRouter = Router();

gameScoresRouter.post("/", async (req: Request, res: Response) => {
  const parsed = gameScoreCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("game_scores")
    .insert({
      business_id: parsed.data.businessId,
      user_id: userId,
      session_id: parsed.data.sessionId,
      scenario_id: parsed.data.scenarioId,
      scenario_name: parsed.data.scenarioName,
      score: parsed.data.score,
      max_score: parsed.data.maxScore,
      performance_metrics: parsed.data.performanceMetrics ?? null,
    })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({
    data: {
      id: data.id,
      businessId: data.business_id,
      sessionId: data.session_id,
      scenarioId: data.scenario_id,
      scenarioName: data.scenario_name,
      score: data.score,
      maxScore: data.max_score,
      performanceMetrics: data.performance_metrics,
      completedAt: data.completed_at,
    },
  });
});
