// Live market figures (treasury yields, inflation, stock index, exchange size)
// for the country a business is in, sourced from Google Search through Gemini.
//
// The rule this module enforces: NOTHING IS SHOWN THAT ISN'T BACKED BY A GOOGLE
// SEARCH RESULT. An AI model asked for "the latest T-bill rate" will happily
// invent a plausible number, so the model is only allowed to report figures it
// found, each one has to name the website it came from, and that website must
// be one Google actually returned for the search (its grounding metadata).
// A figure that fails any check is dropped. If nothing survives, the answer is
// "unavailable" - never an estimate.
//
// Even so, a figure is only as good as the page it came from, so every figure
// keeps its own "as of" date and source, and the UI tells people to confirm
// with their bank, broker or the exchange before acting.

export type FigureKey = "inflation" | "policy_rate" | "treasury_bill" | "stock_index" | "exchange_market_cap";

const FIGURE_KEYS: FigureKey[] = ["inflation", "policy_rate", "treasury_bill", "stock_index", "exchange_market_cap"];
const MAX_PER_KEY: Record<FigureKey, number> = { inflation: 1, policy_rate: 1, treasury_bill: 2, stock_index: 2, exchange_market_cap: 1 };
/** A figure whose own date is older than this is dropped as stale. */
export const MAX_FIGURE_AGE_DAYS = 180;

export interface MarketProfile {
  code: string | null;
  country: string;
  exchange: string;
  indexes: string[];
  centralBank: string;
  /** True when this country is in Aziiki's directory; false means the model must identify the market itself. */
  known: boolean;
}

interface DirectoryEntry { country: string; exchange: string; indexes: string[]; centralBank: string }

// Names of each country's central bank, main stock exchange and headline
// index. These are stable facts used only to point the search at the right
// institutions - the numbers themselves always come from the live search.
const DIRECTORY: Record<string, DirectoryEntry> = {
  GH: { country: "Ghana", exchange: "Ghana Stock Exchange (GSE)", indexes: ["GSE Composite Index"], centralBank: "Bank of Ghana" },
  NG: { country: "Nigeria", exchange: "Nigerian Exchange (NGX)", indexes: ["NGX All-Share Index"], centralBank: "Central Bank of Nigeria" },
  KE: { country: "Kenya", exchange: "Nairobi Securities Exchange (NSE)", indexes: ["NSE All Share Index (NASI)", "NSE 20 Share Index"], centralBank: "Central Bank of Kenya" },
  ZA: { country: "South Africa", exchange: "Johannesburg Stock Exchange (JSE)", indexes: ["FTSE/JSE All Share Index"], centralBank: "South African Reserve Bank" },
  EG: { country: "Egypt", exchange: "Egyptian Exchange (EGX)", indexes: ["EGX 30 Index"], centralBank: "Central Bank of Egypt" },
  TZ: { country: "Tanzania", exchange: "Dar es Salaam Stock Exchange (DSE)", indexes: ["DSE All Share Index (DSEI)"], centralBank: "Bank of Tanzania" },
  UG: { country: "Uganda", exchange: "Uganda Securities Exchange (USE)", indexes: ["USE All Share Index"], centralBank: "Bank of Uganda" },
  ZM: { country: "Zambia", exchange: "Lusaka Securities Exchange (LuSE)", indexes: ["LuSE All Share Index"], centralBank: "Bank of Zambia" },
  RW: { country: "Rwanda", exchange: "Rwanda Stock Exchange (RSE)", indexes: ["RSE All Share Index"], centralBank: "National Bank of Rwanda" },
  ET: { country: "Ethiopia", exchange: "Ethiopian Securities Exchange (ESX)", indexes: [], centralBank: "National Bank of Ethiopia" },
  BW: { country: "Botswana", exchange: "Botswana Stock Exchange (BSE)", indexes: ["BSE Domestic Company Index"], centralBank: "Bank of Botswana" },
  NA: { country: "Namibia", exchange: "Namibian Stock Exchange (NSX)", indexes: ["NSX Overall Index"], centralBank: "Bank of Namibia" },
  MU: { country: "Mauritius", exchange: "Stock Exchange of Mauritius (SEM)", indexes: ["SEMDEX"], centralBank: "Bank of Mauritius" },
  MA: { country: "Morocco", exchange: "Casablanca Stock Exchange", indexes: ["MASI (Moroccan All Shares Index)"], centralBank: "Bank Al-Maghrib" },
  CM: { country: "Cameroon", exchange: "Douala Stock Exchange (DSX)", indexes: [], centralBank: "Bank of Central African States (BEAC)" },
  US: { country: "United States", exchange: "New York Stock Exchange (NYSE) and Nasdaq", indexes: ["S&P 500"], centralBank: "US Federal Reserve" },
  GB: { country: "United Kingdom", exchange: "London Stock Exchange (LSE)", indexes: ["FTSE 100", "FTSE All-Share"], centralBank: "Bank of England" },
  CA: { country: "Canada", exchange: "Toronto Stock Exchange (TSX)", indexes: ["S&P/TSX Composite Index"], centralBank: "Bank of Canada" },
  IN: { country: "India", exchange: "National Stock Exchange of India (NSE) and BSE", indexes: ["Nifty 50", "BSE Sensex"], centralBank: "Reserve Bank of India" },
  DE: { country: "Germany (Eurozone)", exchange: "Frankfurt Stock Exchange (Deutsche Börse)", indexes: ["DAX"], centralBank: "European Central Bank" },
};

// West African monetary union members share one exchange (the BRVM) and one central bank.
const BRVM_COUNTRIES: Record<string, string> = { SN: "Senegal", CI: "Côte d'Ivoire", BJ: "Benin", BF: "Burkina Faso", ML: "Mali", NE: "Niger", TG: "Togo", GW: "Guinea-Bissau" };
for (const [code, country] of Object.entries(BRVM_COUNTRIES)) {
  DIRECTORY[code] = { country, exchange: "Bourse Régionale des Valeurs Mobilières (BRVM)", indexes: ["BRVM Composite Index"], centralBank: "Central Bank of West African States (BCEAO)" };
}

// Used only when a business has no country on file.
const CURRENCY_TO_COUNTRY: Record<string, string> = {
  GHS: "GH", NGN: "NG", KES: "KE", ZAR: "ZA", EGP: "EG", TZS: "TZ", UGX: "UG", ZMW: "ZM", RWF: "RW", ETB: "ET",
  BWP: "BW", NAD: "NA", MUR: "MU", MAD: "MA", USD: "US", GBP: "GB", CAD: "CA", INR: "IN", EUR: "DE",
};

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Picks the market to research: the business's country first, then its currency. */
export function resolveMarket(countryCode?: string | null, currency?: string | null): MarketProfile {
  const code = (countryCode && /^[A-Za-z]{2}$/.test(countryCode) ? countryCode.toUpperCase() : null) ?? (currency ? CURRENCY_TO_COUNTRY[currency.toUpperCase()] ?? null : null);
  if (!code) return { code: null, country: "an unknown country", exchange: "its main stock exchange", indexes: [], centralBank: "its central bank", known: false };
  const entry = DIRECTORY[code];
  if (entry) return { code, ...entry, known: true };
  return { code, country: regionName(code), exchange: "its main stock exchange", indexes: [], centralBank: "its central bank", known: false };
}

export function buildPrompt(profile: MarketProfile, today: Date): string {
  const date = today.toISOString().slice(0, 10);
  const where = profile.known
    ? `Country: ${profile.country}. Central bank: ${profile.centralBank}. Stock exchange: ${profile.exchange}${profile.indexes.length ? `. Headline index: ${profile.indexes.join(" / ")}` : ""}.`
    : `Country: ${profile.country}${profile.code ? ` (ISO code ${profile.code})` : ""}. First identify this country's central bank, its government treasury-bill instrument and its main stock exchange, then research them.`;

  return `Today's date is ${date}. Use Google Search to find the CURRENT published figures for this market:
${where}

Find these figures, each from a page you actually found in your search results:
- "inflation": the latest annual inflation rate.
- "policy_rate": the central bank's current policy interest rate.
- "treasury_bill": the latest government treasury-bill yield (for example the 91-day bill). You may give up to two tenors.
- "stock_index": the latest year-to-date change or level of the exchange's headline index. You may give up to two indexes.
- "exchange_market_cap": the total market capitalisation of the stock exchange, if it publishes one.

STRICT RULES:
- Report ONLY figures you found in a search result. Do NOT estimate, round from memory, or fill gaps. If you can't find a figure, leave it out of the list.
- Every figure MUST include "asOf" (the date the source page gives for that figure, as YYYY-MM-DD or "Month YYYY") and "sourceDomain" (the website's domain it came from, such as "bog.gov.gh").
- Use the number exactly as the source states it, including its unit and currency (for example "24.6%" or "GHS 80.2 billion").
- Prefer the central bank, the exchange, or the national statistics office as the source.

Reply with ONLY this JSON:
{"figures":[{"key":"inflation|policy_rate|treasury_bill|stock_index|exchange_market_cap","label":"short name, e.g. 91-day T-bill","value":"the figure","trend":"up|down|flat","asOf":"date","sourceDomain":"domain"}]}`;
}

export interface GroundedSource { title: string; url: string }

/** The pages Google Search actually returned for the answer. */
export function extractGroundedSources(response: unknown): GroundedSource[] {
  const chunks = (response as { candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }> })
    ?.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const out: GroundedSource[] = [];
  for (const c of chunks) {
    const title = c?.web?.title?.trim();
    const url = c?.web?.uri?.trim();
    if (!title || !url || !/^https:\/\//i.test(url)) continue;
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title, url });
  }
  return out;
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0];
}

/** Same site, allowing a subdomain either way (data.bog.gov.gh vs bog.gov.gh). */
export function hostsMatch(a: string, b: string): boolean {
  const x = normalizeHost(a);
  const y = normalizeHost(b);
  if (!x || !y || !x.includes(".") || !y.includes(".")) return false;
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
}

export interface Figure {
  key: FigureKey;
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  asOf: string;
  source: string;
}

/** Days between an "as of" string and now, or null if it isn't a readable date. */
export function ageInDays(asOf: string, now: Date): number | null {
  const t = Date.parse(/^\d{4}-\d{2}$/.test(asOf) ? `${asOf}-28` : asOf);
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / 86_400_000;
}

export interface MarketAnswer {
  available: true;
  countryCode: string | null;
  country: string;
  sourceName: string;
  exchange: { name: string; marketCap: Figure | null };
  localInflation: Figure | null;
  rates: Array<{ asset: string; rate: string; trend: "up" | "down" | "flat"; safety: string; source: string; asOf: string }>;
  sources: GroundedSource[];
  /** Figures the model returned that failed a check and were left out. */
  dropped: number;
  retrievedAt: string;
}

/**
 * Turns the model's raw answer into what's safe to show. Returns null when no
 * figure survives, which the caller reports as "unavailable".
 */
export function shapeMarketAnswer(profile: MarketProfile, raw: unknown, sources: GroundedSource[], now: Date): MarketAnswer | null {
  const list = (raw as { figures?: unknown })?.figures;
  if (!Array.isArray(list) || sources.length === 0) return null;

  const kept: Figure[] = [];
  const perKey: Partial<Record<FigureKey, number>> = {};
  let dropped = 0;

  for (const item of list) {
    const f = item as Record<string, unknown>;
    const key = f?.key as FigureKey;
    const label = typeof f?.label === "string" ? f.label.trim() : "";
    const value = typeof f?.value === "string" ? f.value.trim() : "";
    const asOf = typeof f?.asOf === "string" ? f.asOf.trim() : "";
    const domain = typeof f?.sourceDomain === "string" ? f.sourceDomain.trim() : "";

    const valid =
      FIGURE_KEYS.includes(key) &&
      label.length > 0 && label.length <= 80 &&
      value.length > 0 && value.length <= 60 && /\d/.test(value) &&
      asOf.length > 0 && asOf.length <= 40 &&
      domain.length > 0 &&
      // The model must cite a site Google actually returned.
      sources.some((s) => hostsMatch(domain, s.title));
    const age = valid ? ageInDays(asOf, now) : null;
    const stale = age !== null && age > MAX_FIGURE_AGE_DAYS;
    // An "as of" that can't be read as a date is not proof of freshness, but
    // the source check above already ties the figure to a real page.
    if (!valid || stale || (perKey[key] ?? 0) >= MAX_PER_KEY[key]) {
      dropped += 1;
      continue;
    }
    perKey[key] = (perKey[key] ?? 0) + 1;
    const trend = f.trend === "up" || f.trend === "down" ? f.trend : "flat";
    kept.push({ key, label, value, trend, asOf, source: normalizeHost(domain) });
  }

  if (kept.length === 0) return null;

  const inflation = kept.find((f) => f.key === "inflation") ?? null;
  const marketCap = kept.find((f) => f.key === "exchange_market_cap") ?? null;
  const rates = kept
    .filter((f) => f.key === "policy_rate" || f.key === "treasury_bill" || f.key === "stock_index")
    .map((f) => ({
      asset: f.label,
      rate: f.value,
      trend: f.trend,
      safety: f.key === "stock_index" ? "Stock market risk" : "Government / central bank",
      source: f.source,
      asOf: f.asOf,
    }));

  return {
    available: true,
    countryCode: profile.code,
    country: profile.country,
    sourceName: profile.known ? `${profile.centralBank} and ${profile.exchange}` : `${profile.country} central bank and stock exchange`,
    exchange: { name: profile.exchange, marketCap },
    localInflation: inflation,
    rates,
    sources,
    dropped,
    retrievedAt: now.toISOString(),
  };
}

export interface MarketUnavailable {
  available: false;
  reason: "not_configured" | "busy" | "unverified" | "error";
  message: string;
}

export const UNAVAILABLE_MESSAGES: Record<MarketUnavailable["reason"], string> = {
  not_configured: "Live market figures aren't switched on for this Aziiki server yet, so nothing is shown. Aziiki never shows estimated figures.",
  busy: "The live market service is busy right now. Please try again in a few minutes.",
  unverified: "Couldn't confirm live figures against Google Search results for your country just now, so nothing is shown. Aziiki never shows estimated figures.",
  error: "Couldn't reach the live market service just now. Please try again shortly.",
};

// One recent answer per country is shared by everyone in it: it keeps costs
// and quota down, and gives everyone the same numbers.
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { answer: MarketAnswer; expiresAt: number }>();

export function getCached(key: string, now = Date.now()): MarketAnswer | null {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return hit.answer;
}

export function setCached(key: string, answer: MarketAnswer, now = Date.now()): void {
  cache.set(key, { answer, expiresAt: now + CACHE_TTL_MS });
}

export function clearMarketCache(): void {
  cache.clear();
}
