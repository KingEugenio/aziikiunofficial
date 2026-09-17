import { afterEach, describe, expect, it } from "vitest";
import { checkLockout, clearLockout, recordFailedAttempt } from "./loginLockout";
import { getServiceRoleClient } from "../supabaseClients";

// Real integration tests against the live Postgres rate_limit_counters
// table (migration 0056), not mocks - this module is security-critical
// (account lockout), and this codebase has already been bitten once this
// session by a mocked-vs-real divergence class of bug elsewhere. A unique
// throwaway email per test run keeps this from colliding with itself or
// anything else hitting the same table.
const TEST_EMAIL = `loginlockout-test-${Date.now()}@example.com`;

afterEach(async () => {
  await clearLockout(TEST_EMAIL);
});

describe("checkLockout", () => {
  it("reports not locked for an account with no failed attempts", async () => {
    const status = await checkLockout(TEST_EMAIL);
    expect(status.locked).toBe(false);
  });
});

describe("recordFailedAttempt", () => {
  it("does not lock the account before the 5th failed attempt", async () => {
    for (let i = 0; i < 4; i++) {
      const status = await recordFailedAttempt(TEST_EMAIL);
      expect(status.locked).toBe(false);
    }
    expect((await checkLockout(TEST_EMAIL)).locked).toBe(false);
  });

  it("locks the account on the 5th failed attempt, with a 60s first-stage cooldown", async () => {
    for (let i = 0; i < 4; i++) {
      await recordFailedAttempt(TEST_EMAIL);
    }
    const fifth = await recordFailedAttempt(TEST_EMAIL);
    expect(fifth.locked).toBe(true);
    expect(fifth.retryAfterSeconds).toBe(60);

    const status = await checkLockout(TEST_EMAIL);
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
    expect(status.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  // 10 sequential recordFailedAttempt calls, each a real round-trip to
  // Postgres - the default 5s per-test timeout is tight for that even
  // alone, and flakes when other test files' own real DB round-trips run
  // concurrently against the same project (vitest runs files in parallel
  // by default). A longer timeout here is the honest fix, not a mock.
  it("escalates the cooldown on a repeat lockout of the same account", async () => {
    // First lockout cycle - stage 1, 60s cooldown.
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(TEST_EMAIL);
    }
    // A real user waiting out a lockout doesn't clear it themselves - only
    // clearLockout() (a successful login) or the row's own expiry does.
    // Deleting just the "locked" key here simulates the cooldown expiring
    // without losing the "stage" memory, which is exactly the distinction
    // recordFailedAttempt's escalation logic depends on.
    await getServiceRoleClient()
      .from("rate_limit_counters")
      .delete()
      .eq("key", `lockout:locked:${TEST_EMAIL.toLowerCase()}`);

    // Second lockout cycle - stage 2, 5 minute cooldown.
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(TEST_EMAIL);
    }
    const status = await checkLockout(TEST_EMAIL);
    expect(status.locked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(60);
    expect(status.retryAfterSeconds).toBeLessThanOrEqual(5 * 60);
  }, 15_000);
});

describe("clearLockout", () => {
  it("removes an active lockout so the account can sign in again", async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(TEST_EMAIL);
    }
    expect((await checkLockout(TEST_EMAIL)).locked).toBe(true);

    await clearLockout(TEST_EMAIL);

    expect((await checkLockout(TEST_EMAIL)).locked).toBe(false);
  });

  it("is case-insensitive on email, matching normalize()", async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedAttempt(TEST_EMAIL.toUpperCase());
    }
    expect((await checkLockout(TEST_EMAIL)).locked).toBe(true);

    await clearLockout(TEST_EMAIL.toUpperCase());

    expect((await checkLockout(TEST_EMAIL)).locked).toBe(false);
  });
});
