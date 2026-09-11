import type { Request, Response, NextFunction } from "express";

/**
 * Runs after requireAuth. Row Level Security (public.is_admin(), migration
 * 0031) is what actually stops a non-admin from reading/writing admin-only
 * tables even if this check were somehow bypassed - this middleware exists
 * so a non-admin gets a clean 403 immediately instead of a confusing empty
 * result or RLS-denied error deep in a route handler.
 *
 * Also loads is_superadmin and admin_permissions.sections (migration 0045)
 * onto the request, so requireSection below doesn't need a second query.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { data, error } = await req
    .supabase!.from("profiles")
    .select("is_admin, is_superadmin")
    .eq("id", req.user!.id)
    .single();

  if (error || !data?.is_admin) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }

  req.isSuperAdmin = Boolean(data.is_superadmin);

  if (!req.isSuperAdmin) {
    const { data: permRow } = await req.supabase!.from("admin_permissions").select("sections").eq("user_id", req.user!.id).maybeSingle();
    req.adminSections = permRow?.sections ?? [];
  }

  next();
}

/**
 * A superadmin always passes. A regular admin needs `section` in their
 * admin_permissions.sections array (set by another superadmin via
 * /admin/admins - see src/admin/AdminsPanel.tsx). Missing admin_permissions
 * table (migration 0045 not applied yet) fails OPEN for superadmins (who
 * are unaffected - they bypass this check entirely) and fails CLOSED for
 * everyone else (an empty sections array from requireAdmin above), which
 * matches the pre-migration reality: only the superadmin(s) had access.
 */
export function requireSection(section: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.isSuperAdmin) {
      next();
      return;
    }
    if (req.adminSections?.includes(section)) {
      next();
      return;
    }
    res.status(403).json({ error: `You don't have access to this section of the admin portal.` });
  };
}
