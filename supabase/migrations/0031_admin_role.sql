-- Adds a single admin flag to profiles, backing the new /admin portal
-- (requireAdmin middleware, see src/server/middleware/requireAdmin.ts).
-- Deliberately not a separate roles table - there is exactly one admin
-- capability today (full control of feature flags, announcements, and
-- surveys), not a spectrum of admin permission levels, so a boolean is the
-- correct amount of complexity. No row starts out true; the first admin is
-- set directly via a one-off UPDATE run by the project owner.

alter table public.profiles add column is_admin boolean not null default false;

-- security definer so it can be called from RLS policies on other tables
-- (feature_flags, admin_announcements, surveys, ...) without those policies
-- needing their own visibility into profiles to check the caller's role.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- profiles_select_own (migration 0002) only lets a user see their own row.
-- The admin portal needs to resolve other users' emails (e.g. to show who a
-- feature-flag override or announcement applies to) - add an admin-only
-- extension rather than relaxing the existing policy for everyone.
create policy "profiles_select_admin"
  on public.profiles for select
  using (public.is_admin());
