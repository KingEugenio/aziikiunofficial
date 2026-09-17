import { Redis } from "@upstash/redis";
import { env } from "./env";

// Optional now that rate limiting no longer depends on Upstash (see
// rateLimitStorePostgres.ts) - this client only backs the short-TTL
// read-through cache below, which works fine without it, just without
// the caching benefit (every call falls straight through to its loader).
const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
    : null;

/**
 * Short-TTL read-through cache for frequently-read, rarely-changed data
 * (dashboard aggregates, list endpoints, session/profile lookups). Callers
 * pass a loader that hits Postgres on a cache miss; the result is cached for
 * `ttlSeconds` so repeat requests within that window skip the database.
 *
 * This is the "cache-check-then-database-fallback" pattern referenced
 * throughout the route handlers. With no Upstash configured, this is
 * simply `return loader()` every time - correct, just uncached.
 */
export async function cached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  if (!redis) return loader();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) {
      return hit;
    }
  } catch (err) {
    // Same fail-open reasoning as rateLimitStorePostgres.ts: a cache being briefly
    // unreachable should degrade to "just hit the database", never crash
    // the request entirely.
    console.error(`[redis] cache read failed for key ${key}, falling back to source:`, err);
  }
  const fresh = await loader();
  // Fire-and-forget: a cache write failure should never fail the request.
  redis.set(key, fresh, { ex: ttlSeconds }).catch((err) => {
    console.error(`[redis] failed to cache key ${key}:`, err);
  });
  return fresh;
}

/** Invalidate one or more cache keys after a write (create/update/delete). */
export async function invalidate(...keys: string[]): Promise<void> {
  if (!redis || keys.length === 0) return;
  try {
    await redis.del(...keys);
  } catch (err) {
    console.error(`[redis] failed to invalidate keys ${keys.join(", ")}:`, err);
  }
}
