import { z } from "zod";
import { uuidField, nonEmptyString } from "./common";

// Money Quiz (src/components/MoneyGame.tsx): a scenario-based financial
// literacy quiz, separate from the Four Ways to Earn simulation game.
// Feature flag: money_game_feature.

export const gameSessionCreateSchema = z.object({
  businessId: uuidField,
  gameState: z.record(z.string(), z.unknown()).optional(),
});

export const gameSessionUpdateSchema = z.object({
  sessionEndedAt: z.string().datetime().optional(),
  totalScore: z.number().int().min(0).optional(),
  scenariosCompleted: z.number().int().min(0).optional(),
  gameState: z.record(z.string(), z.unknown()).optional(),
});

export const gameScoreCreateSchema = z.object({
  businessId: uuidField,
  sessionId: uuidField,
  scenarioId: nonEmptyString.max(100),
  scenarioName: nonEmptyString.max(200),
  score: z.number().int().min(0),
  maxScore: z.number().int().min(1).default(100),
  performanceMetrics: z.record(z.string(), z.unknown()).optional(),
});
