import type { Store, IncrementResponse, Options } from "express-rate-limit";
import { getServiceRoleClient } from "./supabaseClients";

/**
 * Same role as UpstashRateLimitStore (rateLimitStore.ts), on plain
 * Postgres instead of Redis - counters live in the same Supabase project
 * already in use for everything else, via the two RPC functions from
 * migration 0056 (rate_limit_increment/rate_limit_decrement), so a
 * concurrent increment race is still resolved atomically inside Postgres
 * itself, not in this client code.
 *
 * FAILS OPEN, same reasoning as the Redis version: if the database call
 * itself fails (not the normal case - this is the same database every
 * other request in the app already depends on), every method here catches
 * the error and lets the request through rather than blocking
 * signup/login entirely because rate limiting had a bad moment.
 */
export class PostgresRateLimitStore implements Store {
  windowMs = 60_000;
  prefix: string;
  private supabase = getServiceRoleClient();

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private key(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const dbKey = this.key(key);
    try {
      const { data, error } = await this.supabase
        .rpc("rate_limit_increment", { p_key: dbKey, p_window_ms: this.windowMs })
        .single<{ total_hits: number; reset_time: string }>();

      if (error || !data) throw error ?? new Error("no row returned");

      return { totalHits: data.total_hits, resetTime: new Date(data.reset_time) };
    } catch (err) {
      console.error(`[rate-limit:${this.prefix}] Postgres unreachable, failing open for this request:`, err);
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await this.supabase.rpc("rate_limit_decrement", { p_key: this.key(key) });
    } catch (err) {
      console.error(`[rate-limit:${this.prefix}] decrement failed (non-fatal):`, err);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await this.supabase.from("rate_limit_counters").delete().eq("key", this.key(key));
    } catch (err) {
      console.error(`[rate-limit:${this.prefix}] resetKey failed (non-fatal):`, err);
    }
  }
}
