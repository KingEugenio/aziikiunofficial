import type { SupabaseClient, User } from "@supabase/supabase-js";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      supabase?: SupabaseClient;
      accessToken?: string;
      /** Set by requireAdmin - true only for the founder/superadmin account(s), who bypass requireSection entirely. */
      isSuperAdmin?: boolean;
      /** Set by requireAdmin - which admin-portal sections (flags/announcements/surveys/payments/branding/guides/admins) a non-superadmin admin can access. */
      adminSections?: string[];
    }
  }
}

export {};
