import { z } from "zod";
import { emailField } from "./auth";

export const flagUpdateSchema = z.object({
  enabledDefault: z.boolean(),
});

export const flagOverrideSchema = z.object({
  email: emailField,
  enabled: z.boolean(),
});

// Where an announcement is allowed to show. Mirrors App.tsx's `activeTab`
// ids plus the two pre-auth screens - kept in sync manually since the tab
// ids aren't otherwise centrally typed (App.tsx's activeTab is a plain
// string, not a union).
export const ANNOUNCEMENT_TARGET_SCREENS = [
  "all",
  "auth_signin",
  "auth_signup",
  "dashboard",
  "billing",
  "crm",
  "wealth",
  "stock",
  "purchaseOrders",
  "team",
  "exchangeRates",
  "reports",
  "ai",
  "monetize",
  "guide",
] as const;

export const ANNOUNCEMENT_TARGET_TIERS = ["all", "basic", "standard", "pro"] as const;
export const ANNOUNCEMENT_TARGET_ACTIVITY = ["all", "new", "active"] as const;

export const announcementCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(2000),
  targetScreen: z.enum(ANNOUNCEMENT_TARGET_SCREENS).optional(),
  targetTier: z.enum(ANNOUNCEMENT_TARGET_TIERS).optional(),
  targetActivity: z.enum(ANNOUNCEMENT_TARGET_ACTIVITY).optional(),
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

export const siteAssetCreateSchema = z.object({
  kind: z.enum(["logo", "favicon", "document"]),
  fileName: z.string().trim().min(1).max(255),
  storagePath: z.string().trim().min(1).max(500),
  contentType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive().max(20 * 1024 * 1024), // 20MB cap
});
