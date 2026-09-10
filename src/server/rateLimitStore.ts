import type { Store, IncrementResponse, Options } from "express-rate-limit";
import { redis } from "./redis";

/**
 * express-rate-limit ships an in-memory store by default, which only counts
 * requests seen by the single process handling them - useless the moment
 * you run more than one server instance behind a load balancer. This store
 * keeps counters in Upstash Redis instead, so the limit is enforced
 * correctly no matter how many instances are running.
 *
 * FAILS OPEN: if Upstash itself is unreachable (paused free-tier database,
 * expired token, a network blip, etc.) every method here catches the error,
 * logs it loudly, and lets the request through rather than throwing. Rate
 * limiting exists to protect the app from abuse - it must never become the
 * single point of failure that takes down signup/login entirely when a
 * third-party dependency has a bad moment. The tradeoff (briefly
 * un-rate-limited while Upstash is down) is far preferable to every user
 * being unable to log in at all.
 */
export class UpstashRateLimitStore implements Store {
  windowMs = 60_000;
  prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private key(key: string): string {
    return `ratelimit:${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redisKey = this.key(key);
    try {
      const totalHits = await redis.incr(redisKey);
      if (totalHits === 1) {
        await redis.pexpire(redisKey, this.windowMs);
      }
      const ttl = await redis.pttl(redisKey);
      const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs));
      return { totalHits, resetTime };
    } catch (err) {
      console.error(`[rate-limit:${this.prefix}] Upstash unreachable, failing open for this request:`, err);
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.key(key);
    try {
      const current = await redis.decr(redisKey);
      if (current <= 0) {
        await redis.del(redisKey);
      }
    } catch (err) {
      console.error(`[rate-limit:${this.prefix}] decrement failed (non-fatal):`, err);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await redis.del(this.key(key));
    } catch (err) {
      console.error(`[rate-limit:${this.prefix}] resetKey failed (non-fatal):`, err);
    }
  }
}
