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

-- Admins/business owners can view all activity logs for their business
create policy "activity_logs_select_own_business"
  on public.activity_logs for select
  using (
    business_id in (
      select business_id from public.business_memberships 
      where user_id = auth.uid() and (role = 'owner' or role = 'admin')
      union
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Only service-role (backend middleware) inserts logs, never authenticated users
-- No delete/update policies - logs are immutable once created

create trigger activity_logs_enforce_business_ownership
  before insert on public.activity_logs
  for each row execute function public.enforce_business_ownership();
