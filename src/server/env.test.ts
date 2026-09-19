import { afterEach, describe, expect, it, vi } from "vitest";

// env.ts validates process.env at import time, so each case sets the
// variables first and imports a fresh copy of the module.
const load = async () => {
  vi.resetModules();
  return (await import("./env")).env;
};

describe("env PORT", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["unset", undefined, 5173],
    ["empty", "", 5173],
    ["zero (what a serverless platform may pass)", "0", 5173],
    ["not a number", "abc", 5173],
    ["a real port", "8080", 8080],
  ])("%s -> %s", async (_label, value, expected) => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_ANON_KEY", "a".repeat(30));
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "b".repeat(30));
    if (value === undefined) vi.stubEnv("PORT", undefined as unknown as string);
    else vi.stubEnv("PORT", value);
    expect((await load()).PORT).toBe(expected);
  });

  it("still refuses to start without Supabase config", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    await expect(load()).rejects.toThrow(/SUPABASE_URL/);
  });
});
