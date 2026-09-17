-- analytics_events (migration 0018) was created with only
-- analytics_events_select_own - correct for a future "your own activity"
-- page, but it meant nothing could ever read the aggregate this table was
-- actually built for ("Part 9: ... admin dashboards"). Adds the missing
-- admin-read policy (see public.is_admin(), migration 0031) so the admin
-- portal's new feature-analytics panel can query it. Writes still go
-- exclusively through the service-role ingestion endpoint
-- (src/server/routes/analytics.ts) - no insert/update/delete policy is
-- added here, matching 0018's original intent.
create policy "analytics_events_select_admin"
  on public.analytics_events for select
  using (public.is_admin());
