-- Detailed audit trail logging all user actions across the platform:
-- logins, document generation, uploads, CRUD operations, payments, etc.
-- Accessible to admins/business owners for compliance and monitoring.

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  action_type text not null check (action_type in (
    'login', 'logout', 'create', 'read', 'update', 'delete',
    'upload', 'download', 'export', 'payment', 'settings_change'
  )),
  entity_type text not null,
  entity_id uuid,
  timestamp timestamptz not null default now(),
  changes jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index activity_logs_business_id_idx on public.activity_logs (business_id);
create index activity_logs_user_id_idx on public.activity_logs (user_id);
create index activity_logs_timestamp_idx on public.activity_logs (timestamp);
create index activity_logs_business_timestamp_idx on public.activity_logs (business_id, timestamp desc);
create index activity_logs_business_user_timestamp_idx on public.activity_logs (business_id, user_id, timestamp desc);
create index activity_logs_action_type_idx on public.activity_logs (action_type);

alter table public.activity_logs enable row level security;

-- Read only by Aziiki's own platform admins (profiles.is_admin, migration
-- 0031) - this is the /api/admin/activity-logs panel, not a per-business
-- "my team's activity" view, so it's gated the same way every other admin
-- table in this codebase is, not by business ownership/membership.
create policy "activity_logs_select_admin"
  on public.activity_logs for select
  using (public.is_admin());

-- Only service-role (backend middleware, see logActivity() in
-- src/server/routes/activityAudit.ts) inserts logs, never authenticated
-- users directly - no insert policy is needed for that (RLS denies by
-- default and the service-role client bypasses RLS entirely).
-- No delete/update policies - logs are immutable once created.

-- Defense-in-depth (see migration 0001): confirms business_id genuinely
-- belongs to user_id even though these rows are only ever service-role
-- inserted, so a bug in the logging middleware can't silently mis-attribute
-- an entry to the wrong business.
create trigger activity_logs_enforce_ownership
  before insert or update on public.activity_logs
  for each row execute function public.enforce_business_ownership();
