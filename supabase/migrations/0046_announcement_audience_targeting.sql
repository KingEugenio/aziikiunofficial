-- Two more targeting factors for announcements, on top of target_screen
-- (migration 0041): which subscription tier, and how active the account
-- is. Both default to 'all' (today's behavior - everyone sees it).
--
-- Note on scope: "which features someone uses most" isn't targetable yet -
-- feature-usage analytics (src/lib/analytics.ts) is currently tracked only
-- in each browser's localStorage, never synced to the server, so there's
-- no per-account usage data to query here. Real feature-usage targeting
-- would need that synced server-side first; flagged as a real gap, not
-- silently faked.
alter table public.admin_announcements
  add column if not exists target_tier text not null default 'all',
  add column if not exists target_activity text not null default 'all';

comment on column public.admin_announcements.target_tier is
  'Which subscription tier sees this: ''all'', ''basic'', ''standard'', or ''pro''.';
comment on column public.admin_announcements.target_activity is
  'How active the account is: ''all'', ''new'' (0 recorded transactions - true first-timers), or ''active'' (5+ recorded transactions).';
