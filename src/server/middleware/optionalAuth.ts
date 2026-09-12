import type { Request, Response, NextFunction } from "express";
import { getUserScopedClient } from "../supabaseClients";

/**
 * Like requireAuth, but never rejects the request - a valid Bearer token
 * populates req.user/req.supabase/req.accessToken exactly as requireAuth
 * does, while a missing or invalid one just leaves them unset and lets the
 * request through. For routes that work for both guests and signed-in
 * users (e.g. /api/gemini) but still want to know WHO is calling when
 * possible, for things like tier-aware rate limiting.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    next();
    return;
  }

  try {
    const supabase = getUserScopedClient(token);
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) {
      req.user = data.user;
      req.supabase = supabase;
      req.accessToken = token;
    }
  } catch (err) {
    // Same network/DNS failure case requireAuth guards against - here it's
    // not fatal, just means this request proceeds unauthenticated.
    console.error("[optionalAuth] failed to verify session, proceeding as guest:", err);
  }
  next();
}
