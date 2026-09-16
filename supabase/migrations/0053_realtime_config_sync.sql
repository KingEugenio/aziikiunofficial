-- Enables Supabase Realtime (Postgres logical replication) on the three
-- tables GET /api/config/features reads - feature_flags,
-- user_feature_overrides, and profiles - so an already-open browser tab
-- can be told the instant an admin changes something, instead of only
-- finding out on its own next login or after the 15-minute
-- stale-while-revalidate cache window naturally expires (see
-- src/lib/realtimeConfigSync.ts). RLS still applies to what a
-- subscriber actually receives - this only controls whether change
-- events are broadcast at all, not who is allowed to see them.
alter publication supabase_realtime add table public.feature_flags;
alter publication supabase_realtime add table public.user_feature_overrides;
alter publication supabase_realtime add table public.profiles;
