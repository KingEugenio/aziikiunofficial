-- workspace_designer_smart_collapse (added in 0066) was never wired to any
-- behavior - nothing in src/ reads it, confirmed by a full-repo grep. It sat
-- in the admin Feature Flags panel looking like a working toggle that did
-- nothing when clicked (flagged in the September 24 project audit). Building
-- the described behavior for real (auto-collapse the Invoice/Receipt
-- Workspace Designer panel on save) would need a new controlled-collapse
-- mode on the shared CollapsibleSection component plus new dirty-state
-- tracking in a component that has none today - a real feature, not cleanup
-- - so this just removes the dead toggle instead of half-building it.
delete from public.feature_flags where key = 'workspace_designer_smart_collapse';
