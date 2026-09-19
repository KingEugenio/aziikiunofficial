/**
 * Decides whether a session already stored on this device can stand in for a
 * fresh password login for the email that was just typed.
 *
 * Reusing it skips POST /api/auth/login, which costs several database
 * round-trips (rate-limit counters, the per-account lockout check and clear,
 * the security-event log) plus the auth server itself - pointless when the
 * device is already signed in as that exact account. Deliberately
 * conservative: any doubt returns null and the caller falls through to the
 * normal login, so this can only ever skip work, never grant access the
 * stored session didn't already give.
 */
export interface StoredSessionLike {
  access_token: string;
  expires_at?: number; // seconds since epoch
  user?: { email?: string | null; factors?: Array<{ status?: string }> | null } | null;
}

const MIN_REMAINING_MS = 2 * 60 * 1000;

function readAal(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).aal ?? null;
  } catch {
    return null;
  }
}

export function pickReusableSession<T extends StoredSessionLike>(
  session: T | null | undefined,
  typedEmail: string,
  nowMs: number = Date.now()
): T | null {
  if (!session?.user?.email) return null;
  if (session.user.email.trim().toLowerCase() !== typedEmail.trim().toLowerCase()) return null;
  if ((session.expires_at ?? 0) * 1000 - nowMs < MIN_REMAINING_MS) return null;

  // An account with a verified authenticator must be at its fully verified
  // level (aal2) - a half-finished sign-in (password done, code not entered)
  // must never be waved through as "already signed in".
  const hasVerifiedFactor = (session.user.factors ?? []).some((f) => f.status === "verified");
  if (hasVerifiedFactor && readAal(session.access_token) !== "aal2") return null;

  return session;
}
