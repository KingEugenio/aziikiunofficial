-- Net Worth & Investments (Asset Registry, Yield Holdings, the live
-- stock/T-Bill sourcing desk, Debts, and Goals - all one screen,
-- NetWorthInvestments.tsx) was seeded as Phase 3 in migration 0032,
-- matching the teardown doc's own suggested order. The project owner has
-- since asked for it explicitly as part of MVP 2 instead - it's fully
-- built and tested already, this is a rollout-priority change only, no
-- code or schema behind the flag changes.
update public.feature_flags
set phase = 2
where key = 'net_worth_investments';
