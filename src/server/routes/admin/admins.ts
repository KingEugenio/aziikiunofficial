import { Router, type Request, type Response } from "express";
import { z } from "zod";

export const adminAdminsRouter = Router();

const ALL_SECTIONS = ["dashboard", "flags", "announcements", "surveys", "payments", "branding", "guides", "admins"] as const;

function requireSuperAdmin(req: Request, res: Response): boolean {
  if (!req.isSuperAdmin) {
    res.status(403).json({ error: "Only a superadmin can manage other admins." });
    return false;
  }
  return true;
}

// Every admin account, with their permission sections - superadmin-only,
// so a regular admin (even one with every section granted) can't see or
// change who else has admin access.
adminAdminsRouter.get("/", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  const supabase = req.supabase!;
  const { data: admins, error } = await supabase.from("profiles").select("id, email, is_superadmin").eq("is_admin", true);

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  const { data: permissions } = await supabase.from("admin_permissions").select("user_id, sections");
  const sectionsByUser = new Map((permissions ?? []).map((p) => [p.user_id, p.sections as string[]]));

  res.json({
    data: (admins ?? []).map((a) => ({
      id: a.id,
      email: a.email,
      isSuperAdmin: a.is_superadmin,
      sections: a.is_superadmin ? [...ALL_SECTIONS] : sectionsByUser.get(a.id) ?? [],
    })),
  });
});

const grantSchema = z.object({
  email: z.string().trim().email(),
  sections: z.array(z.enum(ALL_SECTIONS)).default([]),
});

// Grants admin access to an existing Aziiki account by email (this does
// NOT create a new account - the person must already have signed up).
adminAdminsRouter.post("/", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  const parsed = grantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { data: profile, error: findError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email.toLowerCase())
    .maybeSingle();

  if (findError) {
    res.status(400).json({ error: findError.message });
    return;
  }
  if (!profile) {
    res.status(404).json({ error: "No Aziiki account found with that email. They need to sign up first." });
    return;
  }

  const { error: updateError } = await supabase.from("profiles").update({ is_admin: true }).eq("id", profile.id);
  if (updateError) {
    res.status(400).json({ error: updateError.message });
    return;
  }

  const { error: permError } = await supabase
    .from("admin_permissions")
    .upsert({ user_id: profile.id, sections: parsed.data.sections, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (permError) {
    res.status(400).json({ error: permError.message });
    return;
  }

  res.status(201).json({ data: { id: profile.id, email: parsed.data.email, sections: parsed.data.sections } });
});

const updateSchema = z.object({
  sections: z.array(z.enum(ALL_SECTIONS)),
});

// Updates a non-superadmin admin's sections. Deliberately cannot change
// is_superadmin here or target a superadmin account - that has to stay a
// deliberate, separate, harder-to-misclick action than a routine
// permissions edit; do it directly in the database if truly needed.
adminAdminsRouter.put("/:userId/sections", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", issues: parsed.error.issues });
    return;
  }

  const supabase = req.supabase!;
  const { data: target } = await supabase.from("profiles").select("is_superadmin").eq("id", req.params.userId).maybeSingle();
  if (target?.is_superadmin) {
    res.status(400).json({ error: "A superadmin's access can't be narrowed here." });
    return;
  }

  const { error } = await supabase
    .from("admin_permissions")
    .upsert({ user_id: req.params.userId, sections: parsed.data.sections, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.json({ data: { userId: req.params.userId, sections: parsed.data.sections } });
});

// Revokes admin access entirely (not a superadmin - guarded the same way).
adminAdminsRouter.delete("/:userId", async (req: Request, res: Response) => {
  if (!requireSuperAdmin(req, res)) return;

  const supabase = req.supabase!;
  const { data: target } = await supabase.from("profiles").select("is_superadmin").eq("id", req.params.userId).maybeSingle();
  if (target?.is_superadmin) {
    res.status(400).json({ error: "A superadmin's access can't be revoked here." });
    return;
  }

  const { error } = await supabase.from("profiles").update({ is_admin: false }).eq("id", req.params.userId);
  if (error) {
    res.status(400).json({ error: error.message });
    return;
  }
  await supabase.from("admin_permissions").delete().eq("user_id", req.params.userId);

  res.status(204).send();
});
