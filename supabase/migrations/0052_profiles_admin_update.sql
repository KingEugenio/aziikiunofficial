-- Found while verifying the new admin Users panel: PUT
-- /admin/subscription-plans/users/:email/tier (src/server/routes/admin/
-- subscriptionPlans.ts) has never actually been able to change another
-- account's tier. Every admin route reads/writes through req.supabase, a
-- client scoped to the admin's own token (see requireAuth.ts), so it's
-- still subject to RLS - and profiles only ever had profiles_update_own
-- (migration 0002), which restricts writes to id = auth.uid(). An UPDATE
-- whose WHERE clause RLS narrows down to zero matching rows is NOT an
-- error in PostgREST/Supabase - it just silently updates nothing and
-- still returns success, which is exactly what was happening: the admin
-- portal always reported success, but the target account's tier never
-- actually changed. This is almost certainly the real root cause behind
-- the "I upgraded someone to Pro but they still couldn't access it" bug
-- report - not (only) the cross-tab cache-staleness bug fixed earlier
-- this session, which could only ever surface a change that had actually
-- been written.
--
-- Same broad "using (public.is_admin())" shape as every other admin-write
-- policy in this codebase (e.g. admin_announcements_write_admin, migration
-- 0033) - RLS here is defense-in-depth behind the app-layer requireAdmin
-- check, not meant to restrict which columns an admin can touch.
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());
