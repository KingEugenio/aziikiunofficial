-- Regional pricing: a Standard/Pro plan now supports one row PER CURRENCY
-- instead of exactly one row per tier - e.g. GHS and NGN rows priced
-- separately for African visitors, a USD row (via Stripe) for everyone
-- else. The webhook matcher (src/server/routes/paymentsWebhook.ts) already
-- matches an incoming charge by (price_minor_units, currency), not tier
-- alone, so it needs no logic change - it just benefits from more rows
-- existing to match against.
alter table public.subscription_plans drop constraint if exists subscription_plans_pkey;
alter table public.subscription_plans add primary key (tier, currency);

-- Which payment processor this specific currency's link points to - a USD
-- row typically uses Stripe (the standard "worldwide" pick), while
-- GHS/NGN/other African-currency rows keep using Paystack, already
-- integrated. Purely informational for the admin UI; the webhook handler
-- itself is Paystack-specific today and only processes paystack rows.
alter table public.subscription_plans add column if not exists provider text not null default 'paystack';
alter table public.subscription_plans drop constraint if exists subscription_plans_provider_check;
alter table public.subscription_plans add constraint subscription_plans_provider_check check (provider in ('paystack', 'stripe'));
