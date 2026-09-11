-- Lets the founder (superadmin) add other admins and choose exactly which
-- admin-portal sections each one can access, instead of every is_admin
-- account automatically getting full access to everything.
alter table public.profiles add column if not exists is_superadmin boolean not null default false;

-- Every account that is already an admin today keeps full access after
-- this migration runs - nobody's access silently narrows the moment this
-- ships. New admins added afterward start with whatever sections the
-- superadmin explicitly grants them.
update public.profiles set is_superadmin = true where is_admin = true;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_superadmin from public.profiles where id = auth.uid()), false);
$$;

-- One row per admin, listing which sections (flags, announcements, surveys,
-- payments, branding, guides, admins) they can access. A superadmin always
-- has every section regardless of what's listed here - see requireSection
-- in src/server/middleware/requireAdmin.ts.
create table if not exists public.admin_permissions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sections text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

alter table public.admin_permissions enable row level security;

create policy "admin_permissions_select"
  on public.admin_permissions for select
  using (user_id = auth.uid() or public.is_superadmin());

create policy "admin_permissions_write_superadmin"
  on public.admin_permissions for all
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- Existing admins get every section by default (matches "full access"
-- behavior they already had before this migration).
insert into public.admin_permissions (user_id, sections)
select id, array['dashboard','flags','announcements','surveys','payments','branding','guides','admins']
from public.profiles
where is_admin = true
on conflict (user_id) do nothing;
