-- The Phase 2 learning game shipped under a working name (migration 0061) that
-- borrowed a book's trademarked title. It is now "Four Ways to Earn" with the
-- flag key four_ways_game. This carries over whatever the admin portal had set
-- for the old flag, then removes it (its per-user overrides go with it).
insert into public.feature_flags (key, name, description, phase, enabled_default)
select
  'four_ways_game',
  'Four Ways to Earn (money game)',
  'A money game about the four ways people earn (employee, own account, business owner, investor) and how assets can cover your expenses.',
  2,
  coalesce((select enabled_default from public.feature_flags where key = 'cashflow_quadrant_game'), true)
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      phase = excluded.phase;

insert into public.user_feature_overrides (user_id, flag_key, enabled)
select user_id, 'four_ways_game', enabled
from public.user_feature_overrides
where flag_key = 'cashflow_quadrant_game'
on conflict (user_id, flag_key) do nothing;

delete from public.feature_flags where key = 'cashflow_quadrant_game';
