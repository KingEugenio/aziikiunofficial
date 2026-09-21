import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_FIGURE_AGE_DAYS, ageInDays, buildPrompt, clearMarketCache, extractGroundedSources, getCached, hostsMatch, resolveMarket,
  setCached, shapeMarketAnswer, type GroundedSource,
} from "./marketData";

const NOW = new Date("2026-09-21T12:00:00Z");
const GH = resolveMarket("GH", "GHS");
const sources: GroundedSource[] = [
  { title: "bog.gov.gh", url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a" },
  { title: "gse.com.gh", url: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/b" },
];
const fig = (over: Record<string, unknown> = {}) => ({ key: "treasury_bill", label: "91-day T-bill", value: "10.5%", trend: "down", asOf: "2026-09-12", sourceDomain: "bog.gov.gh", ...over });

describe("resolveMarket", () => {
  it("uses the business's country and names its real exchange and central bank", () => {
    expect(GH).toMatchObject({ code: "GH", country: "Ghana", known: true });
    expect(GH.exchange).toContain("Ghana Stock Exchange");
    expect(GH.centralBank).toBe("Bank of Ghana");
  });
  it("prefers the country over the currency (XOF is shared by several countries)", () => {
    const sn = resolveMarket("sn", "XOF");
    expect(sn.country).toBe("Senegal");
    expect(sn.exchange).toContain("BRVM");
  });
  it("falls back to the currency's country when no country is on file", () => {
    expect(resolveMarket(undefined, "NGN").code).toBe("NG");
    expect(resolveMarket(null, "ghs").code).toBe("GH");
  });
  it("handles a country that isn't in the directory by asking the model to identify the market", () => {
    const fr = resolveMarket("FR", "EUR");
    expect(fr.known).toBe(false);
    expect(fr.country).toBe("France");
    expect(buildPrompt(fr, NOW)).toContain("First identify this country's central bank");
  });
  it("copes with nothing to go on", () => {
    expect(resolveMarket(undefined, undefined).code).toBeNull();
    expect(resolveMarket("1!", "???").code).toBeNull();
  });
});

describe("buildPrompt", () => {
  it("gives today's date, names the country's institutions and forbids estimating", () => {
    const p = buildPrompt(GH, NOW);
    expect(p).toContain("2026-09-21");
    expect(p).toContain("Bank of Ghana");
    expect(p).toContain("Ghana Stock Exchange");
    expect(p).toContain("exchange_market_cap");
    expect(p).toMatch(/Do NOT estimate/);
    expect(p).toMatch(/sourceDomain/);
  });
});

describe("extractGroundedSources", () => {
  it("reads the pages Google returned, de-duplicated", () => {
    const res = { candidates: [{ groundingMetadata: { groundingChunks: [
      { web: { title: "bog.gov.gh", uri: "https://x/1" } },
      { web: { title: "BoG.gov.gh", uri: "https://x/2" } },
      { web: { title: "gse.com.gh", uri: "https://x/3" } },
    ] } }] };
    expect(extractGroundedSources(res).map((s) => s.title)).toEqual(["bog.gov.gh", "gse.com.gh"]);
  });
  it("returns nothing when the answer wasn't grounded, or links aren't https", () => {
    expect(extractGroundedSources({})).toEqual([]);
    expect(extractGroundedSources({ candidates: [{}] })).toEqual([]);
    expect(extractGroundedSources({ candidates: [{ groundingMetadata: { groundingChunks: [{ web: { title: "a.com", uri: "http://a.com" } }, { web: { uri: "https://b" } }] } }] })).toEqual([]);
  });
});

describe("hostsMatch", () => {
  it("matches the same site across www, paths and subdomains", () => {
    expect(hostsMatch("bog.gov.gh", "www.bog.gov.gh")).toBe(true);
    expect(hostsMatch("https://www.bog.gov.gh/rates", "bog.gov.gh")).toBe(true);
    expect(hostsMatch("data.bog.gov.gh", "bog.gov.gh")).toBe(true);
  });
  it("doesn't match different sites or look-alikes", () => {
    expect(hostsMatch("bog.gov.gh", "gse.com.gh")).toBe(false);
    expect(hostsMatch("evilbog.gov.gh", "bog.gov.gh")).toBe(false);
    expect(hostsMatch("gov.gh", "")).toBe(false);
    expect(hostsMatch("localhost", "localhost")).toBe(false);
  });
});

describe("ageInDays", () => {
  it("reads full dates, month-year and month names, and rejects the unreadable", () => {
    expect(ageInDays("2026-09-11", NOW)).toBeCloseTo(10.5, 0);
    expect(ageInDays("2026-08", NOW)).toBeGreaterThan(0);
    expect(ageInDays("September 2026", NOW)).not.toBeNull();
    expect(ageInDays("recently", NOW)).toBeNull();
  });
});

describe("shapeMarketAnswer", () => {
  it("keeps figures backed by a Google result and shapes them for the screen", () => {
    const raw = { figures: [
      fig(),
      { key: "inflation", label: "Inflation", value: "9.4%", trend: "down", asOf: "2026-08", sourceDomain: "bog.gov.gh" },
      { key: "stock_index", label: "GSE Composite Index", value: "+31.2% YTD", trend: "up", asOf: "2026-09-19", sourceDomain: "www.gse.com.gh" },
      { key: "exchange_market_cap", label: "Market capitalisation", value: "GHS 150.3 billion", trend: "flat", asOf: "2026-09-19", sourceDomain: "gse.com.gh" },
    ] };
    const a = shapeMarketAnswer(GH, raw, sources, NOW)!;
    expect(a.available).toBe(true);
    expect(a.localInflation?.value).toBe("9.4%");
    expect(a.exchange.marketCap?.value).toBe("GHS 150.3 billion");
    expect(a.rates.map((r) => r.asset)).toEqual(["91-day T-bill", "GSE Composite Index"]);
    expect(a.rates[1]).toMatchObject({ trend: "up", source: "gse.com.gh", asOf: "2026-09-19" });
    expect(a.retrievedAt).toBe(NOW.toISOString());
    expect(a.sources).toEqual(sources);
    expect(a.dropped).toBe(0);
  });

  it("drops a figure whose cited website Google never returned (a made-up source)", () => {
    const a = shapeMarketAnswer(GH, { figures: [fig(), fig({ key: "policy_rate", label: "Policy rate", value: "18%", sourceDomain: "totally-real-bank.example" })] }, sources, NOW)!;
    expect(a.rates).toHaveLength(1);
    expect(a.dropped).toBe(1);
  });

  it("drops values with no number, missing dates, and stale figures", () => {
    const raw = { figures: [
      fig({ value: "high" }),
      fig({ asOf: "" }),
      fig({ asOf: "2025-01-01" }),
      fig({ label: "x".repeat(200) }),
      fig({ key: "made_up_key" }),
      fig({ value: "9.9%" }),
    ] };
    const a = shapeMarketAnswer(GH, raw, sources, NOW)!;
    expect(a.rates.map((r) => r.rate)).toEqual(["9.9%"]);
    expect(a.dropped).toBe(5);
    expect(MAX_FIGURE_AGE_DAYS).toBeGreaterThan(30);
  });

  it("caps how many figures of one kind are shown", () => {
    const raw = { figures: [fig({ value: "1%" }), fig({ value: "2%" }), fig({ value: "3%" })] };
    expect(shapeMarketAnswer(GH, raw, sources, NOW)!.rates).toHaveLength(2);
  });

  it("returns nothing at all when the answer had no Google sources, or nothing survives", () => {
    expect(shapeMarketAnswer(GH, { figures: [fig()] }, [], NOW)).toBeNull();
    expect(shapeMarketAnswer(GH, { figures: [fig({ sourceDomain: "nope.example" })] }, sources, NOW)).toBeNull();
    expect(shapeMarketAnswer(GH, { figures: [] }, sources, NOW)).toBeNull();
    expect(shapeMarketAnswer(GH, null, sources, NOW)).toBeNull();
    expect(shapeMarketAnswer(GH, { figures: "nope" }, sources, NOW)).toBeNull();
  });
});

describe("answer cache", () => {
  beforeEach(() => clearMarketCache());
  it("serves an answer for 30 minutes, then forgets it", () => {
    const a = shapeMarketAnswer(GH, { figures: [fig()] }, sources, NOW)!;
    setCached("GH", a, 1_000);
    expect(getCached("GH", 1_000 + 29 * 60_000)).toBe(a);
    expect(getCached("GH", 1_000 + 31 * 60_000)).toBeNull();
    expect(getCached("NG", 1_000)).toBeNull();
  });
});
