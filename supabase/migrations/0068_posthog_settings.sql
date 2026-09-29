-- PostHog (product analytics) configuration, moved from a build-time
-- VITE_POSTHOG_KEY env var into the same admin-editable key-value store
-- Site Content already uses (migration 0047) - so it can be turned on/off
-- or re-keyed from the admin portal, live, with no rebuild or redeploy.
-- A PostHog project API key is meant to be public (it can only submit
-- events, never read data back) - same reasoning site_settings already
-- being world-readable rests on for support_email/social links/etc. - but
-- unlike that seeded contact info, a specific project's real key doesn't
-- belong hardcoded into a migration file that ships with the codebase
-- itself, so this seeds it empty/off. Whoever runs this fresh sets their
-- own key from /admin -> PostHog Analytics; this project's own live
-- database has its already-working key applied directly (not via this
-- file) so nothing broke when the client switched over to read this
-- instead of the env var.
insert into public.site_settings (key, value) values
  ('posthog_enabled', 'false'),
  ('posthog_key', ''),
  ('posthog_host', 'https://us.i.posthog.com')
on conflict (key) do nothing;
