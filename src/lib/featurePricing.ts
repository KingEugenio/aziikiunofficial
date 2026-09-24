import { api } from "./api";
import { useCachedResource } from "./sessionCache";
import { formatMoneyIntl } from "./currency";

export interface FeaturePrice {
  flagKey: string;
  price: number | null;
  currency: string | null;
  billingType: "one_time" | "recurring";
  recurringInterval: "monthly" | "yearly" | null;
  paymentLink: string | null;
  accessMessage: string | null;
}

/**
 * Every feature an admin has marked paid (Admin Portal -> Payments ->
 * Feature Pricing). A feature not in this list is simply free - it's
 * governed purely by the existing flag/phase/tier system, unchanged.
 * Cached the same way useFeatureFlags() is, so a price change from admin
 * reaches an already-open session within the same window a flag flip does.
 */
export function useFeaturePricing() {
  const { data, loaded } = useCachedResource("aziiki_cache_feature_pricing", () => api.config.featurePricing());
  const byFlagKey = new Map((data ?? []).map((p) => [p.flagKey, p]));
  return { pricing: data ?? [], byFlagKey, loaded };
}

/** "GHS 50/month", "GHS 50 one-time", or null if this isn't priced at all. */
export function formatFeaturePrice(price: FeaturePrice): string | null {
  if (price.price == null || !price.currency) return null;
  const amount = formatMoneyIntl(price.price, price.currency);
  if (price.billingType === "recurring") {
    return `${amount}/${price.recurringInterval === "yearly" ? "year" : "month"}`;
  }
  return `${amount} one-time`;
}
