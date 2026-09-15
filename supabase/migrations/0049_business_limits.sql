-- Tracks how many times a business's name has been changed, so the app can
-- cap it at 2 (see src/server/routes/businessLimits.ts) - without this, a
-- Basic account (limited to one business profile) could rename the same
-- business repeatedly to reuse one account across many unrelated
-- businesses, defeating the tier's whole point.
alter table public.businesses add column if not exists name_edit_count integer not null default 0;
