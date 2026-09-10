import type { Request, Response, NextFunction } from "express";

/**
 * Runs after requireAuth. Row Level Security (public.is_admin(), migration
 * 0031) is what actually stops a non-admin from reading/writing admin-only
 * tables even if this check were somehow bypassed - this middleware exists
 * so a non-admin gets a clean 403 immediately instead of a confusing empty
 * result or RLS-denied error deep in a route handler.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { data, error } = await req.supabase!.from("profiles").select("is_admin").eq("id", req.user!.id).single();

  if (error || !data?.is_admin) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  next();
}
