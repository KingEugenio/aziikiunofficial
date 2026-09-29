-- Closes the other half of the subscription lifecycle: charge.success
-- already upgrades a tier automatically (migration 0042), but nothing
-- reacted when a Paystack subscription actually stopped - a cancelled or
-- non-renewing customer stayed on their paid tier forever. This mirrors
-- subscription_payment_events for the cancellation side of the same flow
-- (see the paymentsWebhook.ts handleSubscriptionCancellation handler),
-- keyed by Paystack's subscription_code instead of a payment reference
-- since a subscription.disable event carries no charge reference at all.
create table if not exists public.subscription_cancellation_events (
  id uuid primary key default gen_random_uuid(),
  subscription_code text unique not null,
  email text,
  matched_tier text,
  matched_user_id uuid references auth.users (id) on delete set null,
  raw_event jsonb,
  created_at timestamptz not null default now()
);

alter table public.subscription_cancellation_events enable row level security;

create policy "subscription_cancellation_events_select_admin"
  on public.subscription_cancellation_events for select
  using (public.is_admin());

-- No insert policy: only the webhook handler (service-role client, which
-- bypasses RLS entirely) ever writes these rows.
