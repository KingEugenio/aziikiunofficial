-- One more Phase 1 gate the teardown calls out specifically: Brand Kit
-- should ship as "logo + one accent color only" in the MVP, not the full
-- registration/tax/VAT/address/footer-text/legal-disclaimer editor. Added
-- as its own migration (not folded into 0032's seed) since 0032 may already
-- be applied on the live project - new flags always arrive as a new
-- migration from here on.
insert into public.feature_flags (key, name, description, phase, enabled_default) values
  ('brand_kit_advanced_fields', 'Brand Kit Advanced Fields', 'Registration number, tax ID, VAT, address, website, footer text, and legal disclaimer fields on Brand Kit - beyond logo + one accent color.', 2, false)
on conflict (key) do nothing;
