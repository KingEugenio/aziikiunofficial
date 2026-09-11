-- A simple, editable punch-list inside the admin portal itself ("Guides")
-- for setup steps and improvement ideas the app owner needs to track -
-- separate from AppGuide.tsx, which is the end-user-facing Academy.
create table if not exists public.admin_guide_items (
  id uuid primary key default gen_random_uuid(),
  title text not null unique,
  description text,
  is_done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.admin_guide_items enable row level security;

create policy "admin_guide_items_admin_only"
  on public.admin_guide_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seeded with the real, current setup/improvement punch-list as of this
-- migration - editable/removable from the portal like any other row.
insert into public.admin_guide_items (title, description, is_done) values
  ('Run migrations 0041-0043 in the Supabase SQL editor', 'Adds announcement screen-targeting, subscription tiers + payment plans, and this Guides table itself. Nothing in this list works until these are applied.', false),
  ('Set the Paystack webhook URL', 'In the Paystack dashboard -> Settings -> API Keys & Webhooks, point the webhook at https://<your-domain>/api/payments/webhook. It already handles both invoice payments and subscription-tier upgrades.', false),
  ('Create a Payment Page per paid tier in Paystack', 'One for Standard, one for Pro, each at a fixed price. Paste both links (and their exact prices) into Payments in this portal - that price is how an incoming payment gets matched back to a tier.', false),
  ('Register with Ghana''s Data Protection Commission', 'Aziiki collects customer names, emails, and phone numbers via the CRM - that makes the business operating it a "data controller" under the Data Protection Act, 2012 (Act 843), renewable every two years.', false),
  ('Decide the default tier for new signups', 'Currently every new account starts on Basic. Confirm that''s the intended default before real users start signing up.', false)
on conflict (title) do nothing;
