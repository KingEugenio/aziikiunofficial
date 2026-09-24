-- Per-feature pricing: lets an admin mark any single feature_flags row as
-- paid (its own price/currency/billing type), separate from and on top of
-- the existing whole-tier subscription_plans (migration 0042). A feature
-- can be:
--   - free (no row here, or is_paid = false): governed purely by the
--     existing flag/phase/tier system, unchanged.
--   - paid, one-time or recurring: has a row here. Whether a given user
--     actually has it is still decided by the EXISTING access system
--     (phase/tier, or a user_feature_overrides row) - this table only adds
--     "and here's what unlocking it costs, and how to pay for it."
--
-- This deliberately does not duplicate access control: granting access
-- after a payment is still just an insert into user_feature_overrides
-- (see the extended webhook in src/server/routes/paymentsWebhook.ts),
-- which is exactly what an admin manually granting a user access already
-- does from the Feature Flags panel. Same table, same effect, whether the
-- grant came from a human or a payment.
create table public.feature_pricing (
  flag_key text primary key references public.feature_flags (key) on delete cascade,
  is_paid boolean not null default true,
  price_minor_units integer check (price_minor_units is null or price_minor_units >= 0),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  billing_type text not null default 'one_time' check (billing_type in ('one_time', 'recurring')),
  -- Only meaningful (and only required) when billing_type = 'recurring'.
  recurring_interval text check (recurring_interval is null or recurring_interval in ('monthly', 'yearly')),
  -- Same pattern and same caveat as subscription_plans.provider: only
  -- Paystack is actually wired up to grant access automatically (see the
  -- webhook). Stripe is accepted here so the admin form and the schema
  -- don't need to change again the day that gets built.
  provider text not null default 'paystack' check (provider in ('paystack', 'stripe')),
  payment_link text,
  -- Shown to users on the paywall instead of a generic "this costs X" line,
  -- e.g. "Includes live investment indices and treasury-bill tracking."
  access_message text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint feature_pricing_recurring_needs_interval
    check (billing_type <> 'recurring' or recurring_interval is not null),
  constraint feature_pricing_paid_needs_price
    check (is_paid = false or (price_minor_units is not null and currency is not null))
);

create trigger feature_pricing_set_updated_at
  before update on public.feature_pricing
  for each row execute function public.set_updated_at();

alter table public.feature_pricing enable row level security;

-- Readable by any authenticated user (and anonymously, via the anon client
-- GET /api/config/feature-pricing uses) - pricing isn't secret, and a
-- signed-out visitor should be able to see what a feature costs before
-- they even sign up. Writable only by admins.
create policy "feature_pricing_select_all"
  on public.feature_pricing for select
  using (true);

create policy "feature_pricing_write_admin"
  on public.feature_pricing for all
  using (public.is_admin())
  with check (public.is_admin());

-- Audit trail for feature-purchase webhook events, mirroring
-- subscription_payment_events exactly (migration 0042) - kept as a
-- separate table rather than reusing that one so a feature purchase is
-- never confused with a whole-tier upgrade in the record itself.
create table public.feature_payment_events (
  id uuid primary key default gen_random_uuid(),
  paystack_reference text unique not null,
  email text,
  amount_minor_units integer,
  matched_flag_key text references public.feature_flags (key) on delete set null,
  matched_user_id uuid references auth.users (id) on delete set null,
  raw_event jsonb,
  created_at timestamptz not null default now()
);

alter table public.feature_payment_events enable row level security;

create policy "feature_payment_events_select_admin"
  on public.feature_payment_events for select
  using (public.is_admin());
-- No insert/update/delete policy: only the webhook's service-role client
-- (which bypasses RLS entirely) ever writes here, same as
-- subscription_payment_events.
