-- The custom Document Template Editor + Gallery has been removed from the
-- app entirely (not just hidden) - the Gallery tab, its component, and its
-- entry points into the invoice/receipt/estimate builder are all gone.
-- Drop the now-meaningless flag and any per-user overrides on it so the
-- admin portal doesn't show a toggle for a feature that no longer exists
-- anywhere in the UI. The underlying document_templates tables/routes stay
-- untouched (dead code, not user-visible, safe to leave rather than risk a
-- destructive schema change).
delete from public.user_feature_overrides where flag_key = 'document_template_editor';
delete from public.feature_flags where key = 'document_template_editor';
