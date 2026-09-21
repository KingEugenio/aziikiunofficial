-- The Cashflow Quadrant Challenge (src/components/CashflowQuadrantGame.tsx) is
-- a Phase 2 feature: a learning game about the E / S / B / I ways of earning.
-- It ships live for Phase 2 accounts (Standard and above) and the admin portal
-- can switch it off or on per user in Feature Flags, like any other flag.
--
-- On conflict only the wording and phase are refreshed: enabled_default is left
-- alone so re-running this never overrides a choice made in the admin portal.
insert into public.feature_flags (key, name, description, phase, enabled_default)
values (
  'cashflow_quadrant_game',
  'Cashflow Quadrant Challenge',
  'A money game about the four ways people earn (employee, self-employed, business owner, investor) and how assets can cover your expenses.',
  2,
  true
)
on conflict (key) do update
  set name = excluded.name,
      description = excluded.description,
      phase = excluded.phase;
