-- Lets the admin portal store a future Basic-tier price ahead of time, so
-- it's ready to switch on later without touching the database by hand -
-- explicitly NOT enforced anywhere yet. No code path checks whether a
-- Basic account has paid; this migration only widens what's a valid row,
-- it does not start charging anyone. Flipping Basic from free to paid for
-- real is a separate, deliberate future change (a signup/renewal gate),
-- not something this migration does on its own.
alter table public.subscription_plans drop constraint if exists subscription_plans_tier_check;
alter table public.subscription_plans add constraint subscription_plans_tier_check check (tier in ('basic', 'standard', 'pro'));
