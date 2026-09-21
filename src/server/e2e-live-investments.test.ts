import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

// The route is tested with Gemini replaced by a stand-in (the real service is
// external and quota-limited); everything else is the real app.
const gemini = vi.hoisted(() => ({ configured: true, respond: (async () => ({})) as () => Promise<unknown> }));
vi.mock("./geminiClient", () => ({
  hasGeminiKeyConfigured: () => gemini.configured,
  generateContentWithFailover: () => gemini.respond(),
}));

import { createApp } from "./app";
import { clearMarketCache } from "./marketData";

const app = createApp();
const grounded = (json: unknown, chunks = [{ web: { title: "bog.gov.gh", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a" } }]) => ({
  text: JSON.stringify(json),
  candidates: [{ groundingMetadata: { groundingChunks: chunks } }],
});
const good = { figures: [{ key: "treasury_bill", label: "91-day T-bill", value: "10.5%", trend: "down", asOf: new Date().toISOString().slice(0, 10), sourceDomain: "bog.gov.gh" }] };
// The route has a per-address hourly cap kept in the real database, so every
// test request comes from its own throwaway address (the app trusts one proxy
// hop) instead of eating into one shared counter.
const randomIp = () => `${10 + Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;
const ask = (body: object = { currency: "GHS", countryCode: "GH" }) =>
  request(app).post("/api/gemini/live-investments").set("X-Forwarded-For", randomIp()).send(body);

afterEach(() => { clearMarketCache(); gemini.configured = true; });

describe("POST /api/gemini/live-investments", () => {
  it("shows nothing (no estimated numbers) when live sourcing isn't configured", async () => {
    gemini.configured = false;
    const res = await ask();
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ available: false, reason: "not_configured" });
    expect(res.body.rates).toBeUndefined();
  });

  it("returns figures backed by Google results, with sources and a server timestamp", async () => {
    gemini.respond = async () => grounded(good);
    const res = await ask();
    expect(res.body.available).toBe(true);
    expect(res.body.country).toBe("Ghana");
    expect(res.body.rates[0]).toMatchObject({ asset: "91-day T-bill", rate: "10.5%", source: "bog.gov.gh" });
    expect(res.body.sources[0].title).toBe("bog.gov.gh");
    expect(Date.now() - Date.parse(res.body.retrievedAt)).toBeLessThan(10_000);
  });

  it("refuses an answer with no Google grounding, even if it contains numbers", async () => {
    gemini.respond = async () => ({ text: JSON.stringify(good), candidates: [{}] });
    expect((await ask()).body).toMatchObject({ available: false, reason: "unverified" });
  });

  it("refuses an answer that isn't valid JSON", async () => {
    gemini.respond = async () => ({ text: "Sure! The rate is about 10%.", candidates: [{ groundingMetadata: { groundingChunks: [{ web: { title: "bog.gov.gh", uri: "https://x/1" } }] } }] });
    expect((await ask()).body).toMatchObject({ available: false, reason: "unverified" });
  });

  it("says the service is busy on a quota error, and never shows fallback numbers", async () => {
    gemini.respond = async () => { throw new Error("429 You exceeded your current quota"); };
    const res = await ask();
    expect(res.body).toMatchObject({ available: false, reason: "busy" });
    expect(JSON.stringify(res.body)).not.toMatch(/\d+(\.\d+)?%/);
  });

  it("shares one recent answer per country instead of asking Google every time", async () => {
    let calls = 0;
    gemini.respond = async () => { calls++; return grounded(good); };
    await ask();
    await ask();
    expect(calls).toBe(1);
    await ask({ currency: "NGN", countryCode: "NG" });
    expect(calls).toBe(2);
  });
});
