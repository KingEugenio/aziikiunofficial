-- businesses has no admin-visibility policy (only owner/team-member select
-- policies from migrations 0003/0026), so an admin's own count query would
-- have silently only counted their own businesses. Mirrors
-- profiles_select_admin from migration 0031 - read-only, for the admin
-- dashboard's platform-wide stats.
create policy "businesses_select_admin"
  on public.businesses for select
  using (public.is_admin());
