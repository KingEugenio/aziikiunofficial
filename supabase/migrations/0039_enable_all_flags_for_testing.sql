-- Project owner's explicit request: every Phase 2+ feature live by default
-- right now, so they can try everything at once and then selectively turn
-- individual features off from the admin portal as their own rollout
-- strategy - the inverse of this migration's own starting point (0032
-- seeded everything off). Nothing about the flags system itself changes;
-- this is just flipping the switches, all still fully reversible from
-- Feature Flags in /admin.
update public.feature_flags set enabled_default = true;
