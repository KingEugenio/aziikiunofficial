-- Granular, admin-controlled feature flags. Replaces the single hardcoded
-- MVP_MODE boolean that used to live in src/App.tsx (it only gated 2 of the
-- ~13 features the product teardown says should ship hidden-not-deleted).
--
-- feature_flags: one row per hideable feature, global on/off default.
-- user_feature_overrides: per-user exceptions to that default, for rolling
-- a feature out to specific users to try before flipping it on for everyone
-- (e.g. beta testers) - see AdMonetizationHub-style gradual rollout ask.
--
-- Both tables are readable by any authenticated user (flags are not secret
-- and the client needs them to decide what to render) but writable only by
-- an admin, via public.is_admin() from migration 0031.

create table public.feature_flags (
  key text primary key,
  name text not null,
  description text not null,
  phase int not null default 2,
  enabled_default boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.user_feature_overrides (
  user_id uuid not null references auth.users (id) on delete cascade,
  flag_key text not null references public.feature_flags (key) on delete cascade,
  enabled boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, flag_key)
);

create index user_feature_overrides_flag_key_idx on public.user_feature_overrides (flag_key);

alter table public.feature_flags enable row level security;
alter table public.user_feature_overrides enable row level security;

create policy "feature_flags_select_all"
  on public.feature_flags for select
  to authenticated, anon
  using (true);

create policy "feature_flags_write_admin"
  on public.feature_flags for all
  using (public.is_admin())
  with check (public.is_admin());

-- A user needs to see their own overrides (to compute their effective flag
-- set); an admin needs to see and manage everyone's.
create policy "user_feature_overrides_select"
  on public.user_feature_overrides for select
  using (user_id = auth.uid() or public.is_admin());

create policy "user_feature_overrides_write_admin"
  on public.user_feature_overrides for insert
  with check (public.is_admin());

create policy "user_feature_overrides_update_admin"
  on public.user_feature_overrides for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "user_feature_overrides_delete_admin"
  on public.user_feature_overrides for delete
  using (public.is_admin());

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- Seed one row per feature the product teardown ("AZIIKI_Brutal_Product_
-- Teardown.docx") says should exist in the code but ship OFF by default in
-- the Phase 1 MVP, to be turned on later per-user (beta) or globally (next
-- phase) from the admin portal. Anything not listed here (core bookkeeping,
-- invoices/receipts/quotations, customers, Health Score, AI CFO, P&L +
-- cash-flow reports, offline sync, Paystack, AppGuide, password + magic
-- link auth) is always-on Phase 1 and needs no flag.
insert into public.feature_flags (key, name, description, phase, enabled_default) values
  ('personal_workspace', 'Personal Workspace', 'Personal finance tracker (accounts, budgets, savings, AI coach) bundled alongside the business tools.', 5, false),
  ('net_worth_investments', 'Net Worth & Investments', 'Wealth tracking, treasury bills, and live-rate investment views.', 3, false),
  ('purchase_orders', 'Purchase Orders', 'Formal supplier ordering workflow, including foreign-currency POs.', 3, false),
  ('business_partners_shareholders', 'Business Partners / Shareholders', 'Equity, ownership %, and capital tracking for multi-owner businesses.', 4, false),
  ('team_memberships_invite_ui', 'Team Invite UI', 'The "invite a teammate" screen. The underlying roles/permissions system stays fully active either way.', 4, false),
  ('ad_monetization_hub', 'Ad Monetization Hub', 'In-app articles, ads, and monetization content hub.', 3, false),
  ('document_template_editor', 'Document Template Editor + Gallery', 'Custom drag-and-block document design system, beyond the fixed starter templates.', 3, false),
  ('exchange_rate_live_switching', 'Live Exchange Rate Switching', 'Location-aware currency switching and live FX rates.', 3, false),
  ('signature_capture', 'Signature Capture', 'Drawn/typed signatures on invoices and quotations.', 2, false),
  ('goals_tracking', 'Goals Tracking', 'Setting and tracking revenue/growth targets.', 2, false),
  ('debts_tracking', 'Debts Owed Tracking', 'Tracking loans and supplier credit the business owes.', 2, false),
  ('multi_business_profiles', 'Multi-Business Profiles', 'Managing more than one business per account.', 2, false),
  ('inventory_management', 'Inventory Management', 'Stock tracking and low-stock alerts.', 2, false),
  ('auth_otp_method', 'One-Time-Code Sign In', 'Email OTP as an additional sign-in method, alongside password and magic link.', 2, false),
  ('mfa_onboarding_prompt', 'MFA Onboarding Prompt', 'Nudging new users to enroll in MFA during onboarding. MFA itself stays available in Settings regardless.', 2, false);
