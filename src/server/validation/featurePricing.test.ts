import { describe, expect, it } from "vitest";
import { featurePricingUpsertSchema } from "./featurePricing";

const validPaid = {
  isPaid: true,
  price: 25,
  currency: "GHS",
  billingType: "one_time" as const,
  recurringInterval: null,
  provider: "paystack" as const,
  paymentLink: "https://paystack.com/pay/my-feature",
  accessMessage: "Unlocks live rates.",
};

describe("featurePricingUpsertSchema", () => {
  it("accepts a valid one-time paid feature", () => {
    expect(featurePricingUpsertSchema.safeParse(validPaid).success).toBe(true);
  });

  it("accepts a valid recurring paid feature with an interval", () => {
    const result = featurePricingUpsertSchema.safeParse({
      ...validPaid,
      billingType: "recurring",
      recurringInterval: "monthly",
    });
    expect(result.success).toBe(true);
  });

  it("accepts marking a feature free, with no price/currency at all", () => {
    const result = featurePricingUpsertSchema.safeParse({
      isPaid: false,
      price: null,
      currency: null,
      billingType: "one_time",
      recurringInterval: null,
      provider: "paystack",
      paymentLink: null,
      accessMessage: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a paid feature with no price", () => {
    const result = featurePricingUpsertSchema.safeParse({ ...validPaid, price: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.path.includes("price"))).toBe(true);
  });

  it("rejects a paid feature with no currency", () => {
    const result = featurePricingUpsertSchema.safeParse({ ...validPaid, currency: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.path.includes("currency"))).toBe(true);
  });

  it("rejects recurring billing with no interval", () => {
    const result = featurePricingUpsertSchema.safeParse({ ...validPaid, billingType: "recurring", recurringInterval: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((i) => i.path.includes("recurringInterval"))).toBe(true);
  });

  it("rejects a negative price", () => {
    expect(featurePricingUpsertSchema.safeParse({ ...validPaid, price: -5 }).success).toBe(false);
  });

  it("rejects an unreasonably large price (likely a data-entry mistake)", () => {
    expect(featurePricingUpsertSchema.safeParse({ ...validPaid, price: 50_000_000 }).success).toBe(false);
  });

  it("rejects a currency that isn't a supported 3-letter code", () => {
    expect(featurePricingUpsertSchema.safeParse({ ...validPaid, currency: "US" }).success).toBe(false);
    expect(featurePricingUpsertSchema.safeParse({ ...validPaid, currency: "ZZZ" }).success).toBe(false);
  });

  it("rejects a payment link that isn't a real URL", () => {
    expect(featurePricingUpsertSchema.safeParse({ ...validPaid, paymentLink: "not-a-url" }).success).toBe(false);
  });

  it("rejects an access message over 300 characters", () => {
    expect(featurePricingUpsertSchema.safeParse({ ...validPaid, accessMessage: "x".repeat(301) }).success).toBe(false);
  });

  it("rejects an unknown billing type or provider", () => {
    expect(featurePricingUpsertSchema.safeParse({ ...validPaid, billingType: "lifetime" }).success).toBe(false);
    expect(featurePricingUpsertSchema.safeParse({ ...validPaid, provider: "flutterwave" }).success).toBe(false);
  });

  it("defaults billingType to one_time and provider to paystack when omitted", () => {
    const { isPaid, price, currency, paymentLink, accessMessage } = validPaid;
    const result = featurePricingUpsertSchema.safeParse({ isPaid, price, currency, paymentLink, accessMessage });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billingType).toBe("one_time");
      expect(result.data.provider).toBe("paystack");
    }
  });
});
