import { getServiceRoleClient } from "../supabaseClients";

/**
 * Progressive account lockout, layered ON TOP OF (not instead of):
 *  - Supabase Auth's own project-wide rate limiting on GoTrue endpoints
 *    (configurable under Dashboard -> Authentication -> Rate Limits), which
 *    protects the project/infrastructure from being overwhelmed but is
 *    IP/project scoped, not per-account.
 *  - The express-rate-limit `loginLimiter` in rateLimiters.ts, which is
 *    IP+email scoped and resets on its own fixed window.
 *
 * This module tracks failed attempts PER ACCOUNT (by normalized email)
 * regardless of source IP, so an attacker spreading attempts across many IPs
 * still can't brute-force one specific account. Cooldown length increases
 * with repeated lockouts of the same account.
 *
 * Runs on the same Postgres-backed rate_limit_counters table as
 * rateLimitStorePostgres.ts (migration 0056), not a separate store -
 * this is a security-critical counter, not a cache, so unlike redis.ts's
 * cached()/invalidate() it must not silently no-op when unconfigured.
 * Postgres is always available (it's the same database every other
 * request in the app already depends on), which is exactly why this
 * moved off Upstash rather than being left dependent on an optional
 * service.
 */

const supabase = getServiceRoleClient();

const FAILED_ATTEMPT_THRESHOLD = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // failed-attempt counter itself expires after 15 minutes of no new failures
const LOCKOUT_STAGES_SECONDS = [60, 5 * 60, 15 * 60, 60 * 60]; // 1m, 5m, 15m, 60m (repeat offenses cap at 60m)
const LOCKOUT_STAGE_MEMORY_MS = 24 * 60 * 60 * 1000; // how long we remember "this account has been locked before"

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

async function increment(key: string, windowMs: number): Promise<number> {
  const { data, error } = await supabase
    .rpc("rate_limit_increment", { p_key: key, p_window_ms: windowMs })
    .single<{ total_hits: number; reset_time: string }>();
  if (error || !data) throw error ?? new Error("no row returned");
  return data.total_hits;
}

async function del(...keys: string[]): Promise<void> {
  await supabase.from("rate_limit_counters").delete().in("key", keys);
}

/** Seconds remaining until `key`'s row expires, or 0 if it doesn't exist / has already expired. */
async function ttlSeconds(key: string): Promise<number> {
  const { data } = await supabase.from("rate_limit_counters").select("expires_at").eq("key", key).maybeSingle();
  if (!data) return 0;
  const remainingMs = new Date(data.expires_at).getTime() - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

export interface LockoutStatus {
  locked: boolean;
  retryAfterSeconds?: number;
}

export async function checkLockout(email: string): Promise<LockoutStatus> {
  const key = `lockout:locked:${normalize(email)}`;
  try {
    const ttl = await ttlSeconds(key);
    if (ttl > 0) {
      return { locked: true, retryAfterSeconds: ttl };
    }
    return { locked: false };
  } catch (err) {
    // Fail open, same reasoning as everywhere else a rate-limit-shaped
    // check depends on a request to the database succeeding: never let
    // this be the reason a legitimate user can't sign in.
    console.error("[loginLockout] checkLockout failed, failing open:", err);
    return { locked: false };
  }
}

/**
 * Call after a failed password verification. Returns the resulting lockout
 * status so the caller can decide what to tell the user (still generically,
 * per the "Incorrect email or password" requirement - only the retry-after
 * timing changes, never the wording).
 */
export async function recordFailedAttempt(email: string): Promise<LockoutStatus> {
  const normalized = normalize(email);
  try {
    const attemptsKey = `lockout:attempts:${normalized}`;
    const attempts = await increment(attemptsKey, ATTEMPT_WINDOW_MS);

    if (attempts < FAILED_ATTEMPT_THRESHOLD) {
      return { locked: false };
    }

    // Threshold reached: lock the account and escalate the cooldown based on
    // how many times this account has been locked recently.
    const stageKey = `lockout:stage:${normalized}`;
    const stage = await increment(stageKey, LOCKOUT_STAGE_MEMORY_MS);

    const cooldownSeconds = LOCKOUT_STAGES_SECONDS[Math.min(stage - 1, LOCKOUT_STAGES_SECONDS.length - 1)];

    const lockedKey = `lockout:locked:${normalized}`;
    await supabase
      .from("rate_limit_counters")
      .upsert({ key: lockedKey, count: 1, expires_at: new Date(Date.now() + cooldownSeconds * 1000).toISOString() });
    await del(attemptsKey);

    return { locked: true, retryAfterSeconds: cooldownSeconds };
  } catch (err) {
    console.error("[loginLockout] recordFailedAttempt failed, failing open:", err);
    return { locked: false };
  }
}

/** Call after a successful login: the rightful owner is back in control. */
export async function clearLockout(email: string): Promise<void> {
  const normalized = normalize(email);
  try {
    await del(`lockout:attempts:${normalized}`, `lockout:locked:${normalized}`, `lockout:stage:${normalized}`);
  } catch (err) {
    console.error("[loginLockout] clearLockout failed (non-fatal):", err);
  }
}
