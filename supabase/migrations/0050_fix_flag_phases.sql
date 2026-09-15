-- Two flag-phase corrections, found via a live DB audit:
--
-- 1. net_worth_investments should already be phase 2 (migration 0038
--    committed this explicitly, per the project owner's own request - "MVP 2
--    instead" of the original phase-3 seed), but production still shows
--    phase 3. Re-applying it here in case 0038 never actually reached prod.
--
-- 2. ad_monetization_hub was seeded at phase 3 in migration 0032 and never
--    promoted. Since GET /api/config/features gates a flag on
--    `enabled_default AND phase <= tier's max phase` (basic->1, standard->2,
--    pro->unlimited - see config.ts), a phase-3 flag stays computed false
--    for every account below Pro no matter what an admin flips in the
--    Feature Flags panel - the toggle only changes enabled_default, it
--    can't touch phase. That's the reported "I turned it on but don't see
--    it" bug. An ad/monetization surface exists to subsidize free-tier
--    usage, not to be a Pro-only perk, so phase 2 (matching migration
--    0039's "everything Phase 2+ ships live, admin selectively disables"
--    convention) is the correct home for it, not phase 3.
update public.feature_flags set phase = 2 where key = 'net_worth_investments';
update public.feature_flags set phase = 2 where key = 'ad_monetization_hub';
