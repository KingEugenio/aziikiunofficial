import { afterEach, describe, expect, it } from "vitest";
import { PostgresRateLimitStore } from "./rateLimitStorePostgres";
import { getServiceRoleClient } from "./supabaseClients";

// Real integration tests against the live Postgres rate_limit_counters
// table (migration 0056), not mocks - same reasoning as
// loginLockout.test.ts: this module gates login/signup/API abuse, and a
// mocked-vs-real divergence is exactly the class of bug that's already
// bitten this project once. A unique key per test run avoids colliding
// with itself or anything else hitting the same table.
const TEST_PREFIX = `test-ratelimit-${Date.now()}`;

function makeStore(windowMs = 60_000): PostgresRateLimitStore {
  const store = new PostgresRateLimitStore(TEST_PREFIX);
  store.init({ windowMs } as any);
  return store;
}

afterEach(async () => {
  await getServiceRoleClient().from("rate_limit_counters").delete().like("key", `${TEST_PREFIX}:%`);
});

describe("increment", () => {
  it("starts a fresh key at 1", async () => {
    const store = makeStore();
    const result = await store.increment("user-a");
    expect(result.totalHits).toBe(1);
  });

  it("counts sequential increments correctly", async () => {
    const store = makeStore();
    const key = "user-b";
    expect((await store.increment(key)).totalHits).toBe(1);
    expect((await store.increment(key)).totalHits).toBe(2);
    expect((await store.increment(key)).totalHits).toBe(3);
  });

  it("keeps resetTime stable across increments within the same window (PEXPIRE-only-on-first-hit)", async () => {
    const store = makeStore();
    const key = "user-c";
    const first = await store.increment(key);
    const second = await store.increment(key);
    // Allow for clock/serialization jitter, but the window must not have
    // been pushed forward by the second hit.
    expect(Math.abs(second.resetTime!.getTime() - first.resetTime!.getTime())).toBeLessThan(1000);
  });

  it("resets the counter once the window actually expires", async () => {
    const store = makeStore(1000); // 1s window
    const key = "user-d";
    expect((await store.increment(key)).totalHits).toBe(1);
    expect((await store.increment(key)).totalHits).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect((await store.increment(key)).totalHits).toBe(1);
  });

  it("keeps different prefixes independent even for the same raw key", async () => {
    const storeA = new PostgresRateLimitStore(`${TEST_PREFIX}-a`);
    storeA.init({ windowMs: 60_000 } as any);
    const storeB = new PostgresRateLimitStore(`${TEST_PREFIX}-b`);
    storeB.init({ windowMs: 60_000 } as any);

    expect((await storeA.increment("same-key")).totalHits).toBe(1);
    expect((await storeA.increment("same-key")).totalHits).toBe(2);
    expect((await storeB.increment("same-key")).totalHits).toBe(1);

    await getServiceRoleClient().from("rate_limit_counters").delete().like("key", `${TEST_PREFIX}-a:%`);
    await getServiceRoleClient().from("rate_limit_counters").delete().like("key", `${TEST_PREFIX}-b:%`);
  });
});

describe("decrement", () => {
  it("reduces the counter by 1", async () => {
    const store = makeStore();
    const key = "user-e";
    await store.increment(key);
    await store.increment(key);
    expect((await store.increment(key)).totalHits).toBe(3);
    await store.decrement(key);
    expect((await store.increment(key)).totalHits).toBe(3);
  });
});

describe("resetKey", () => {
  it("removes the counter entirely so the next increment starts fresh", async () => {
    const store = makeStore();
    const key = "user-f";
    await store.increment(key);
    await store.increment(key);
    await store.resetKey(key);
    expect((await store.increment(key)).totalHits).toBe(1);
  });
});
