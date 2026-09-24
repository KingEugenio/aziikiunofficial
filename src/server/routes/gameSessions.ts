import { Router, type Request, type Response } from "express";
import { gameSessionCreateSchema, gameSessionUpdateSchema } from "../validation/moneyQuiz";

export const gameSessionsRouter = Router();

function fromRow(row: any) {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    sessionStartedAt: row.session_started_at,
    sessionEndedAt: row.session_ended_at,
    totalScore: row.total_score,
    scenariosCompleted: row.scenarios_completed,
    gameState: row.game_state,
  };
}

// Lists this person's own Money Quiz sessions and scores for one business -
// what MoneyGame.tsx's "menu" screen shows (stats + history). RLS (migration
// 0064/0065) already narrows this to the caller's own rows, or every row in
// the business for its owner/Admins, so no extra filtering is needed here.
gameSessionsRouter.get("/", async (req: Request, res: Response) => {
  const supabase = req.supabase!;
  const businessId = req.query.businessId;
  if (typeof businessId !== "string") {
    res.status(400).json({ error: "businessId query param is required" });
    return;
  }

  const [{ data: sessions, error: sessionsError }, { data: scores, error: scoresError }] = await Promise.all([
    supabase.from("game_sessions").select("*").eq("business_id", businessId).order("session_started_at", { ascending: false }).limit(200),
    supabase.from("game_scores").select("*").eq("business_id", businessId).order("completed_at", { ascending: false }).limit(500),
  ]);

  if (sessionsError) {
    res.status(400).json({ error: sessionsError.message });
    return;
  }
  if (scoresError) {
    res.status(400).json({ error: scoresError.message });
    return;
  }

  res.json({
    sessions: (sessions ?? []).map(fromRow),
    scores: (scores ?? []).map((row: any) => ({
      id: row.id,
      businessId: row.business_id,
      sessionId: row.session_id,
      scenarioId: row.scenario_id,
      scenarioName: row.scenario_name,
      score: row.score,
      maxScore: row.max_score,
      performanceMetrics: row.performance_metrics,
      completedAt: row.completed_at,
    })),
  });
});

gameSessionsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = gameSessionCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const userId = req.user!.id;
  const supabase = req.supabase!;

  const { data, error } = await supabase
    .from("game_sessions")
    .insert({
      business_id: parsed.data.businessId,
      user_id: userId,
      game_state: parsed.data.gameState ?? null,
    })
    .select("*")
    .single();

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(201).json({ data: fromRow(data) });
});

gameSessionsRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = gameSessionUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const patch: Record<string, unknown> = {};
  if (parsed.data.sessionEndedAt !== undefined) patch.session_ended_at = parsed.data.sessionEndedAt;
  if (parsed.data.totalScore !== undefined) patch.total_score = parsed.data.totalScore;
  if (parsed.data.scenariosCompleted !== undefined) patch.scenarios_completed = parsed.data.scenariosCompleted;
  if (parsed.data.gameState !== undefined) patch.game_state = parsed.data.gameState;

  const { data, error } = await supabase.from("game_sessions").update(patch).eq("id", req.params.id).select("*").maybeSingle();

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
