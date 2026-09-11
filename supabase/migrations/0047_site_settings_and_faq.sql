-- A generic, admin-editable key-value content store - support contact
-- info, social links, and long-form legal text that should be changeable
-- from the admin portal without a code change or redeploy. Readable by
-- anyone (even signed out - the footer and pre-login Help links need it
-- too); writable only by an admin with the "site_content" section.
create table if not exists public.site_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

create policy "site_settings_select_all"
  on public.site_settings for select
  using (true);

create policy "site_settings_write_admin"
  on public.site_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seeded with the real values already provided - editable from
-- /admin -> Site Content going forward, no code change needed to update
-- them again.
insert into public.site_settings (key, value) values
  ('support_email', 'support@aziiki.com'),
  ('support_phone', ''),
  ('whatsapp_link', ''),
  ('social_instagram', 'https://www.instagram.com/aziiki_ghana?stkn=MWd2dnkzdjR3NnFrMA=='),
  ('social_facebook', 'https://www.facebook.com/profile.php?id=61593918316440'),
  ('social_tiktok', 'https://www.tiktok.com/@aziiki_ghana?_r=1&_t=ZS-99dUCkpD38H'),
  ('legal_terms_of_service', 'Terms of Service content coming soon. Edit this from the admin portal''s Site Content screen.'),
  ('legal_refund_policy', 'Refund Policy content coming soon. Edit this from the admin portal''s Site Content screen.')
on conflict (key) do nothing;

-- Simple admin-editable FAQ list, same "hide, not delete, admin-managed"
-- philosophy as admin_guide_items - add/edit/reorder/remove from the
-- portal, no code change needed.
create table if not exists public.faq_items (
  id uuid primary key default gen_random_uuid(),
  question text not null unique,
  answer text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.faq_items enable row level security;

create policy "faq_items_select_active_or_admin"
  on public.faq_items for select
  using (is_active = true or public.is_admin());

create policy "faq_items_write_admin"
  on public.faq_items for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.faq_items (question, answer, sort_order) values
  ('Is Aziiki free to use?', 'Yes - every core feature (income/expense tracking, invoices, receipts, customer records, and the AI Advisor) is free during Launch Edition. Some advanced features are part of paid Standard/Pro plans - see Plan & Billing for details.', 1),
  ('Does Aziiki work without internet?', 'Yes. You can record transactions, create invoices, and keep working while offline - everything syncs automatically the next time you''re connected.', 2),
  ('How do I get paid through an invoice?', 'Enable Paystack on an invoice when creating it, then share the payment link with your customer via WhatsApp or email. Once they pay, the invoice updates automatically.', 3),
  ('How do I contact support?', 'Use the Contact Support section on the Help & Support page, or reach out on WhatsApp for the fastest response.', 4)
on conflict (question) do nothing;

-- Email preference for the new Settings screen - order/payment/shipment
-- notifications (notification_log, migration 0022) always send regardless
-- and are never gated by this; this only controls promotional/marketing
-- email, off by default (opt-in, not opt-out).
alter table public.profiles add column if not exists marketing_emails_enabled boolean not null default false;

-- Two new core screens (Settings, Help & Support) - same "everything
-- toggleable" convention as migration 0044, default on.
insert into public.feature_flags (key, name, description, phase, enabled_default) values
  ('core_settings', 'Settings', 'Password, MFA, email preferences, and account deletion.', 1, true),
  ('core_help_support', 'Help & Support', 'Help Center, contact support, legal policies, and FAQ.', 1, true)
on conflict (key) do nothing;
