import { GoogleGenAI, ApiError, type GenerateContentParameters } from "@google/genai";
import { env } from "./env";

/**
 * Ordered list of configured Gemini API keys - GEMINI_API_KEY first, then
 * GEMINI_API_KEY_2 and GEMINI_API_KEY_3 if set. Empty if none are
 * configured (AI features stay disabled, same as before).
 *
 * IMPORTANT CAVEAT worth knowing: this only adds real capacity if the
 * extra keys come from separate Google Cloud projects with their own
 * independent quota allocation. Multiple keys generated inside
 * the SAME project commonly share one quota pool, in which case rotating
 * between them doesn't actually increase how many requests you can make -
 * it just spreads the same limit across more keys. This code will use
 * whatever's configured either way; it can't detect which situation you're
 * in from the key string alone.
 */
function getConfiguredGeminiKeys(): string[] {
  return [env.GEMINI_API_KEY, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3].filter(
    (key): key is string => Boolean(key && key.trim())
  );
}

export function hasGeminiKeyConfigured(): boolean {
  return getConfiguredGeminiKeys().length > 0;
}

function isRateLimitOrQuotaError(err: unknown): boolean {
  if (err instanceof ApiError) {
    // 429 = rate limited; 503 sometimes indicates transient overload on
    // Google's side too, worth failing over for the same reason.
    return err.status === 429 || err.status === 503;
  }
  // The SDK doesn't always throw ApiError for every transport failure -
  // fall back to sniffing the message for the quota-specific phrasing
  // Gemini's API returns, so a genuinely different error (bad request,
  // invalid model name, etc.) doesn't get masked by retrying with another
  // key that would fail the exact same way.
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return message.includes("429") || message.includes("quota") || message.includes("rate limit") || message.includes("resource_exhausted");
}

/**
 * Calls ai.models.generateContent(), automatically retrying with the next
 * configured key if the current one is rate-limited or over quota. Any
 * other kind of error (malformed request, invalid model, etc.) is NOT
 * retried across keys, since a different key would fail identically - it's
 * thrown immediately instead.
 */
export async function generateContentWithFailover(
  params: Omit<GenerateContentParameters, never>
): Promise<Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>> {
  const keys = getConfiguredGeminiKeys();
  if (keys.length === 0) {
    throw new Error("No Gemini API key is configured.");
  }

  let lastError: unknown = null;

  for (let i = 0; i < keys.length; i++) {
    const ai = new GoogleGenAI({ apiKey: keys[i] });
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      lastError = err;
      const isLastKey = i === keys.length - 1;
      if (!isRateLimitOrQuotaError(err) || isLastKey) {
        // Either a non-quota error (retrying won't help), or we've already
        // tried every configured key - nothing left to fail over to.
        throw err;
      }
      console.warn(`[gemini] Key ${i + 1}/${keys.length} was rate-limited/over quota, trying the next configured key...`);
    }
  }

  // Unreachable in practice (the loop always either returns or throws),
  // but keeps TypeScript happy about every code path returning/throwing.
  throw lastError instanceof Error ? lastError : new Error("Failed to reach the AI service.");
}
