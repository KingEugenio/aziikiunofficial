-- Lets an admin choose which screen an announcement shows on (e.g. push a
-- "upgrade to Standard" message only on the sign-up page, or only on the
-- Wealth & Goals screen) instead of every announcement blasting to every
-- screen. 'all' (the default) keeps today's behavior - visible everywhere.
-- Safe to run more than once.
alter table public.admin_announcements
  add column if not exists target_screen text not null default 'all';

comment on column public.admin_announcements.target_screen is
  'Where this announcement shows: ''all'', ''auth_signin'', ''auth_signup'', or an app tab id (dashboard, billing, crm, wealth, stock, purchaseOrders, team, exchangeRates, reports, ai, monetize, guide).';
