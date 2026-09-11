-- Three subscription tiers, per account (profiles.tier) rather than per
-- business, since feature flags themselves are computed per-account (see
-- GET /api/config/features) not per-business.
--   basic    - Phase 1 MVP only (the always-on core loop; no flag needed)
--   standard - MVP 1 + MVP 2 (feature_flags.phase <= 2)
--   pro      - everything (no phase cap)
-- A per-user feature_flags override (already existed - see migration 0032)
-- still wins over the tier cap either way: an admin manually granting one
-- user early access to a Phase-3 feature is a deliberate override, not
-- something a tier ceiling should block.
alter table public.profiles add column if not exists tier text not null default 'basic';
alter table public.profiles drop constraint if exists profiles_tier_check;
alter table public.profiles add constraint profiles_tier_check check (tier in ('basic', 'standard', 'pro'));

-- Admin-configured upgrade destination per paid tier: a Paystack Payment
-- Page URL (created in the Paystack dashboard, pasted here - not something
-- this app initializes via the Paystack API) plus the exact amount that
-- page charges, in the currency's smallest unit (pesewas/kobo/cents). The
-- webhook handler (src/server/routes/paymentsWebhook.ts) matches an
-- incoming charge.success event's amount back to a tier via this table,
-- since a plain Payment Page link carries no reference we created
-- ourselves the way invoice payments do.
create table if not exists public.subscription_plans (
  tier text primary key check (tier in ('standard', 'pro')),
  paystack_link text,
  price_minor_units integer,
  currency text not null default 'GHS',
  updated_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;

-- Readable by anyone (even signed-out) so an "Upgrade" button can always
-- show the right link; only an admin can configure it.
create policy "subscription_plans_select_all"
  on public.subscription_plans for select
  using (true);

create policy "subscription_plans_write_admin"
  on public.subscription_plans for all
  using (public.is_admin())
  with check (public.is_admin());

-- Audit trail for tier-upgrade webhook events, separate from
-- payment_transactions (migration 0027-ish) which is specifically for
-- invoice payments this app itself initialized via the Paystack API.
create table if not exists public.subscription_payment_events (
  id uuid primary key default gen_random_uuid(),
  paystack_reference text unique not null,
  email text,
  amount_minor_units integer,
  matched_tier text,
  matched_user_id uuid references auth.users (id) on delete set null,
  raw_event jsonb,
  created_at timestamptz not null default now()
);

alter table public.subscription_payment_events enable row level security;

create policy "subscription_payment_events_select_admin"
  on public.subscription_payment_events for select
  using (public.is_admin());

-- No insert policy: only the webhook handler (service-role client, which
-- bypasses RLS entirely) ever writes these rows.
