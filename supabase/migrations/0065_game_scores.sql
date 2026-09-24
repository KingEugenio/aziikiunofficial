-- Individual scenario scores within a game session
-- Tracks performance metrics for each scenario to enable leaderboards and analytics

create table public.game_scores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.game_sessions (id) on delete cascade,
  scenario_id text not null,
  scenario_name text not null,
  score integer not null,
  max_score integer not null default 100,
  performance_metrics jsonb,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index game_scores_business_id_idx on public.game_scores (business_id);
create index game_scores_user_id_idx on public.game_scores (user_id);
create index game_scores_session_id_idx on public.game_scores (session_id);
create index game_scores_scenario_id_idx on public.game_scores (scenario_id);
create index game_scores_user_id_completed_idx on public.game_scores (user_id, completed_at desc);
create index game_scores_business_scenario_idx on public.game_scores (business_id, scenario_id);

alter table public.game_scores enable row level security;

-- Users can see their own scores; the business owner and team Admins can
-- see everyone's (see game_sessions' matching policy, migration 0064).
create policy "game_scores_select_own_or_admin"
  on public.game_scores for select
  using (
    user_id = auth.uid()
    or public.business_role_for(business_id) in ('Owner', 'Admin')
  );

-- Users can insert their own scores
create policy "game_scores_insert_own"
  on public.game_scores for insert
  with check (user_id = auth.uid());

create trigger game_scores_enforce_business_ownership
  before insert on public.game_scores
  for each row execute function public.enforce_business_ownership();
