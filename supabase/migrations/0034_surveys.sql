-- Admin-authored surveys and the responses users submit to them, backing
-- the admin portal's "run a survey, read the results" ask. questions/answers
-- are jsonb rather than normalized tables - surveys here are short and
-- structurally simple (a handful of text/multiple-choice questions), and
-- jsonb avoids a 3-table join just to render one form.
--
-- questions shape: [{ id: string, type: 'text' | 'choice', prompt: string,
--   options?: string[] }]
-- answers shape: { [questionId]: string }

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  questions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (survey_id, user_id)
);

create index survey_responses_survey_id_idx on public.survey_responses (survey_id);

alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;

create policy "surveys_select"
  on public.surveys for select
  using (is_active = true or public.is_admin());

create policy "surveys_write_admin"
  on public.surveys for all
  using (public.is_admin())
  with check (public.is_admin());

-- A user can submit/see only their own response; an admin sees every
-- response, for the results view.
create policy "survey_responses_select"
  on public.survey_responses for select
  using (user_id = auth.uid() or public.is_admin());

create policy "survey_responses_insert_own"
  on public.survey_responses for insert
  with check (user_id = auth.uid());

create policy "survey_responses_update_own"
  on public.survey_responses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
