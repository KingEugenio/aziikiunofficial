-- Until now, the Phase 1 MVP core screens (Scorecard, Billing, Customer
-- CRM, Reports, AI Advisor, App Guide) were unconditionally rendered -
-- there was no way to turn any of them off from the admin portal the way
-- every Phase 2+ feature already can be. This gives each of them a real
-- flag too, defaulting on, phase 1 (so a subscription tier ceiling never
-- touches them - see migration 0042 - only an explicit admin toggle can).
insert into public.feature_flags (key, name, description, phase, enabled_default) values
  ('core_dashboard', 'Scorecard (Dashboard)', 'The main cash scorecard / business dashboard screen.', 1, true),
  ('core_billing', 'Billing & PDFs', 'Invoices, receipts, and estimates builder.', 1, true),
  ('core_customers', 'Customer CRM', 'Customer directory, balances, and history.', 1, true),
  ('core_reports', 'Reports & Wisdom', 'P&L and cash-flow reports.', 1, true),
  ('core_ai_advisor', 'CFO AI Advisor', 'The AI chat advisor grounded in the business''s own numbers.', 1, true),
  ('core_app_guide', 'App Guide & Academy', 'The in-app help/tutorial screen.', 1, true)
on conflict (key) do nothing;
