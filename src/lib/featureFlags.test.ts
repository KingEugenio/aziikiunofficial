import { describe, expect, it } from "vitest";
import { isFlagEnabled } from "./featureFlags";

describe("isFlagEnabled", () => {
  it("keeps every core screen on when the flags request failed or hasn't loaded (empty map)", () => {
    for (const key of [
      "core_dashboard", "core_billing", "core_customers", "core_reports",
      "core_ai_advisor", "core_app_guide", "core_settings", "core_help_support",
    ]) {
      expect(isFlagEnabled({}, key)).toBe(true);
    }
  });

  it("still lets an admin explicitly turn a core screen off", () => {
    expect(isFlagEnabled({ core_reports: false }, "core_reports")).toBe(false);
    expect(isFlagEnabled({ core_reports: false }, "core_billing")).toBe(true);
  });

  it("keeps Phase 2+ features opt-in: off unless the server explicitly says true", () => {
    expect(isFlagEnabled({}, "net_worth_investments")).toBe(false);
    expect(isFlagEnabled({ net_worth_investments: false }, "net_worth_investments")).toBe(false);
    expect(isFlagEnabled({ net_worth_investments: true }, "net_worth_investments")).toBe(true);
  });
});
