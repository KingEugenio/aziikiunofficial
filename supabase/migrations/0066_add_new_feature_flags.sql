-- Add three new feature flags:
-- 1. money_game_feature - Financial simulation game with budgeting/scenarios/gamification (Phase 2)
-- 2. activity_monitoring_enabled - Detailed audit trail for compliance (Phase 2)
-- 3. workspace_designer_smart_collapse - Auto-expand workspace designer on unsaved changes (Phase 1)

insert into public.feature_flags (key, name, description, phase, enabled_default) values
  ('money_game_feature', 'Money Game', 'Financial simulation game combining budgeting, business scenarios, and gamification. Educational tool for financial literacy.', 2, false),
  ('activity_monitoring_enabled', 'Activity Monitoring', 'Detailed audit trail logging all user actions. Enables bosses/managers to monitor team member activity for compliance and oversight.', 2, false),
  ('workspace_designer_smart_collapse', 'Smart Workspace Designer', 'Workspace designer auto-expands when unsaved changes exist and collapses on save for better mobile screen space.', 1, true)
on conflict (key) do nothing;
