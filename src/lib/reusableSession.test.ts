import { describe, expect, it } from "vitest";
import { pickReusableSession } from "./reusableSession";

const NOW = 1_800_000_000_000;
const inSeconds = (s: number) => Math.floor((NOW + s * 1000) / 1000);

function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "HS256" })}.${b64(claims)}.sig`;
}

const base = (over: Record<string, unknown> = {}) => ({
  access_token: jwt({ aal: "aal1" }),
  expires_at: inSeconds(3600),
  user: { email: "Owner@Example.com", factors: [] as Array<{ status?: string }> },
  ...over,
});

describe("pickReusableSession", () => {
  it("reuses a valid session for the same email (case/space-insensitive)", () => {
    const s = base();
    expect(pickReusableSession(s, "  owner@example.COM ", NOW)).toBe(s);
  });

  it("does not reuse it for a different email", () => {
    expect(pickReusableSession(base(), "someone-else@example.com", NOW)).toBeNull();
  });

  it("does not reuse a session that is expired or about to expire", () => {
    expect(pickReusableSession(base({ expires_at: inSeconds(-10) }), "owner@example.com", NOW)).toBeNull();
    expect(pickReusableSession(base({ expires_at: inSeconds(60) }), "owner@example.com", NOW)).toBeNull();
  });

  it("returns null when there is no session", () => {
    expect(pickReusableSession(null, "owner@example.com", NOW)).toBeNull();
    expect(pickReusableSession(undefined, "owner@example.com", NOW)).toBeNull();
  });

  it("never waves through a half-finished MFA sign-in (verified factor but only aal1)", () => {
    const s = base({ user: { email: "owner@example.com", factors: [{ status: "verified" }] } });
    expect(pickReusableSession(s, "owner@example.com", NOW)).toBeNull();
  });

  it("does reuse an MFA account's session once it is fully verified (aal2)", () => {
    const s = base({
      access_token: jwt({ aal: "aal2" }),
      user: { email: "owner@example.com", factors: [{ status: "verified" }] },
    });
    expect(pickReusableSession(s, "owner@example.com", NOW)).toBe(s);
  });

  it("falls back to null on a token it can't read for an MFA account", () => {
    const s = base({ access_token: "garbage", user: { email: "owner@example.com", factors: [{ status: "verified" }] } });
    expect(pickReusableSession(s, "owner@example.com", NOW)).toBeNull();
  });
});
