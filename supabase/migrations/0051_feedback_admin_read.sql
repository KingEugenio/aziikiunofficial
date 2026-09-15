-- feedback_submissions (migration 0014) was deliberately built with NO
-- select policy at all for authenticated/anon - the intent noted there was
-- "only the service-role key... can read these, e.g. from an internal
-- admin view", but no admin view was ever built. Every admin route in this
-- codebase reads through req.supabase, a client scoped to the admin's own
-- token (see requireAuth.ts), so it's still subject to RLS - it needs its
-- own is_admin() policy just like profiles_select_admin (migration 0031)
-- and admin_announcements_select (migration 0033), otherwise the new
-- Feedback admin panel would silently see zero rows instead of an error.
create policy "feedback_submissions_select_admin"
  on public.feedback_submissions for select
  using (public.is_admin());
