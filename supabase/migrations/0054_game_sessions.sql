-- Money Game sessions: tracks gameplay sessions for financial literacy gamification
-- Each session tracks a complete play-through of scenarios with score and results

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_started_at timestamptz not null default now(),
  session_ended_at timestamptz,
  total_score integer default 0,
  scenarios_completed integer default 0,
  game_state jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index game_sessions_business_id_idx on public.game_sessions (business_id);
create index game_sessions_user_id_idx on public.game_sessions (user_id);
create index game_sessions_user_id_started_idx on public.game_sessions (user_id, session_started_at desc);
create index game_sessions_ended_at_idx on public.game_sessions (session_ended_at) where session_ended_at is not null;

alter table public.game_sessions enable row level security;

-- Users can see their own sessions and admins can see all sessions in their business
create policy "game_sessions_select_own_or_admin"
  on public.game_sessions for select
  using (
    user_id = auth.uid()
    or business_id in (
      select business_id from public.business_memberships 
      where user_id = auth.uid() and (role = 'owner' or role = 'admin')
      union
      select id from public.businesses where owner_id = auth.uid()
    )
  );

-- Users can insert their own sessions
create policy "game_sessions_insert_own"
  on public.game_sessions for insert
  with check (user_id = auth.uid());

-- Users can update their own sessions
create policy "game_sessions_update_own"
  on public.game_sessions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create trigger game_sessions_enforce_business_ownership
  before insert on public.game_sessions
  for each row execute function public.enforce_business_ownership();
