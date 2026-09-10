-- Admin-authored announcements broadcast to every user (product updates,
-- "we just shipped X"), independent of notification_log (migration 0022)
-- which is per-business/per-event (overdue invoice, payment received) and
-- always emailed. Announcements are in-app only, one-to-many, and read
-- state is tracked per user via admin_announcement_reads rather than a
-- read_at column on the announcement itself.

create table public.admin_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index admin_announcements_active_idx on public.admin_announcements (is_active, created_at desc);

create table public.admin_announcement_reads (
  announcement_id uuid not null references public.admin_announcements (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.admin_announcements enable row level security;
alter table public.admin_announcement_reads enable row level security;

-- Every signed-in user can see active announcements (that's the point);
-- only an admin can see inactive/past ones or write new ones.
create policy "admin_announcements_select"
  on public.admin_announcements for select
  using (is_active = true or public.is_admin());

create policy "admin_announcements_write_admin"
  on public.admin_announcements for all
  using (public.is_admin())
  with check (public.is_admin());

-- A user marks their own reads; an admin can see everyone's (for a "N of M
-- users have seen this" count in the portal).
create policy "admin_announcement_reads_select"
  on public.admin_announcement_reads for select
  using (user_id = auth.uid() or public.is_admin());

create policy "admin_announcement_reads_insert_own"
  on public.admin_announcement_reads for insert
  with check (user_id = auth.uid());
