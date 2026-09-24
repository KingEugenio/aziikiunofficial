// Aziiki Feature Usage Analytics Tracker
// Used during the Launch Promotion to record background usage metrics for future monetization plans.
import { track } from "@vercel/analytics";
import { api } from "./api";
import { capturePostHogEvent } from "./posthog";

// Matches analytics_events.event_category's check constraint (migration
// 0018) - which FeatureUsage key maps to which of the 9 allowed categories,
// so the admin portal's Feature Analytics panel can query a real,
// cross-user table instead of only Vercel's own dashboard.
const EVENT_CATEGORY: Record<keyof FeatureUsage, string> = {
  invoicesCreated: "document",
  receiptsCreated: "document",
  estimatesCreated: "document",
  documentsUploaded: "document",
  crmProfilesAdded: "engagement",
  inventoryAdjusted: "engagement",
  aiQueries: "engagement",
  reportsGenerated: "engagement",
  netWorthUpdates: "engagement",
  rolesModified: "engagement",
  automationRuns: "engagement",
  whatsappShares: "sharing",
  emailShares: "sharing",
  businessSwitches: "navigation",
  guideViews: "navigation",
};

// A stable id for this tab's lifetime (not persisted) - enough to group
// events into a session without needing browser storage for it.
// crypto.randomUUID() only exists in secure contexts (https/localhost) - on
// a plain-http LAN address or an older embedded browser it's undefined, and
// since this line runs at import time (before anything renders) a throw here
// took down the WHOLE app to a white screen. Analytics must never be able to
// do that, so it falls back to a random string.
function makeSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
const sessionId = makeSessionId();

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

  // Same event, to PostHog too - no-ops entirely until VITE_POSTHOG_KEY is
  // set (see lib/posthog.ts), so this is safe to leave in place either way.
  capturePostHogEvent(feature, { category: EVENT_CATEGORY[feature] });

  // Also logs to Aziiki's own analytics_events table (migration 0018/0057)
  // so the admin portal's Feature Analytics panel can show "most used
  // features" without leaving the app. Fire-and-forget: a signed-out guest
  // has no token to authenticate this with, and any failure here must
  // never surface to the feature it's describing either way.
  api.analytics
    .logEvent({ eventName: feature, eventCategory: EVENT_CATEGORY[feature], sessionId })
    .catch(() => {
      // Ignore - see comment above.
    });

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
