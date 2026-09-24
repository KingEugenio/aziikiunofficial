import { z } from "zod";
import { currencyField } from "./common";

// Admin sets a price in the currency's main unit (e.g. "12.50" for GHS
// 12.50), same convention as subscriptionPlans.ts - converted to minor
// units (1250) at the route, matching how Paystack itself reports amounts.
const priceMajorUnitsField = z
  .number()
  .finite()
  .nonnegative("Price can't be negative")
  .max(1_000_000, "That price looks too large - check the number")
  .optional()
  .nullable();

export const featurePricingUpsertSchema = z
  .object({
    isPaid: z.boolean(),
    price: priceMajorUnitsField,
    currency: currencyField.optional().nullable(),
    billingType: z.enum(["one_time", "recurring"]).default("one_time"),
    recurringInterval: z.enum(["monthly", "yearly"]).optional().nullable(),
    provider: z.enum(["paystack", "stripe"]).default("paystack"),
    paymentLink: z.string().trim().url("Must be a valid URL").max(500).optional().nullable(),
    accessMessage: z.string().trim().max(300).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.isPaid) return;
    if (data.price == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "A paid feature needs a price." });
    }
    if (!data.currency) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["currency"], message: "A paid feature needs a currency." });
    }
    if (data.billingType === "recurring" && !data.recurringInterval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurringInterval"],
        message: "Recurring billing needs an interval (monthly or yearly).",
      });
    }
  });

export type FeaturePricingUpsert = z.infer<typeof featurePricingUpsertSchema>;
