// Aziiki Feature Usage Analytics Tracker
// Used during the Launch Promotion to record background usage metrics for future monetization plans.
import { track } from "@vercel/analytics";

export interface FeatureUsage {
  invoicesCreated: number;
  receiptsCreated: number;
  estimatesCreated: number;
  crmProfilesAdded: number;
  inventoryAdjusted: number;
  aiQueries: number;
  reportsGenerated: number;
  netWorthUpdates: number;
  documentsUploaded: number;
  whatsappShares: number;
  emailShares: number;
  businessSwitches: number;
  rolesModified: number;
  guideViews: number;
  automationRuns: number;
}

const STORAGE_KEY = "aziiki_launch_analytics_data";

const defaultAnalytics: FeatureUsage = {
  invoicesCreated: 4,
  receiptsCreated: 2,
  estimatesCreated: 1,
  crmProfilesAdded: 3,
  inventoryAdjusted: 5,
  aiQueries: 8,
  reportsGenerated: 14,
  netWorthUpdates: 6,
  documentsUploaded: 1,
  whatsappShares: 2,
  emailShares: 3,
  businessSwitches: 12,
  rolesModified: 2,
  guideViews: 10,
  automationRuns: 4
};

export function getFeatureAnalytics(): FeatureUsage {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    // Populate default seed analytics so the user sees some starting data
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultAnalytics));
    return defaultAnalytics;
  }
  try {
    const parsed = JSON.parse(data);
    // Ensure all keys are present
    return { ...defaultAnalytics, ...parsed };
  } catch (e) {
    return defaultAnalytics;
  }
}

export function trackFeatureUsage(feature: keyof FeatureUsage): FeatureUsage {
  const current = getFeatureAnalytics();
  current[feature] = (current[feature] || 0) + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));

  // Also log to console in development
  console.log(`[Aziiki Analytics] Background Tracking Feature: "${feature}" - Total: ${current[feature]}`);

  // Real, cross-user tracking: the counter above is per-browser localStorage
  // (seeded with fake demo numbers for AdMonetizationHub's own display) and
  // was never visible to the app's operator. track() sends this same event
  // to Vercel Analytics instead, viewable at vercel.com -> this project ->
  // Analytics - aggregated across every real user. No-ops outside an actual
  // Vercel deployment, no env var or signup needed. Wrapped in try/catch so
  // an analytics failure can never break the feature it's describing.
  try {
    track(feature);
  } catch {
    // Ignore - see comment above.
  }

  return current;
}

export function clearFeatureAnalytics(): FeatureUsage {
  const empty: FeatureUsage = {
    invoicesCreated: 0,
    receiptsCreated: 0,
    estimatesCreated: 0,
    crmProfilesAdded: 0,
    inventoryAdjusted: 0,
    aiQueries: 0,
    reportsGenerated: 0,
    netWorthUpdates: 0,
    documentsUploaded: 0,
    whatsappShares: 0,
    emailShares: 0,
    businessSwitches: 0,
    rolesModified: 0,
    guideViews: 0,
    automationRuns: 0
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(empty));
  return empty;
}
