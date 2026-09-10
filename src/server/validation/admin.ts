import { z } from "zod";
import { emailField } from "./auth";

export const flagUpdateSchema = z.object({
  enabledDefault: z.boolean(),
});

export const flagOverrideSchema = z.object({
  email: emailField,
  enabled: z.boolean(),
});

export const announcementCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
});

const surveyQuestionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  type: z.enum(["text", "choice"]),
  prompt: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
});

export const surveyCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
  questions: z.array(surveyQuestionSchema).min(1).max(20),
});

export const surveyResponseSchema = z.object({
  answers: z.record(z.string(), z.string().trim().max(2000)),
});
