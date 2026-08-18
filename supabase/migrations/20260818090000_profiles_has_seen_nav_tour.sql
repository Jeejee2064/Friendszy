-- Nav tour: brief guided walkthrough of the main nav (one bubble per real
-- nav icon), shown once right after onboarding finishes. `has_seen_nav_tour`
-- gates it: false shows it on the account's next home load, true (set once
-- the user finishes or skips it) hides it forever after.
--
-- Backfilled to true for every profile that already exists at migration
-- time — the tour's trigger is "first home load right after onboarding",
-- which for already-onboarded accounts already happened, long before this
-- feature existed, so they should not suddenly see it on their next login.
-- Only accounts created after this migration keep the column's `false`
-- default and actually get the tour.
--
-- No new GRANT needed: authenticated already has UPDATE on profiles (see
-- supabase/tests/db_test.sql "Grants" section) — GRANT is table-level, not
-- column-level. No RLS/trigger change needed either: enforce_profile_sensitive_columns
-- only protects plan/plan_valid_until/moderation_status/is_admin (see
-- db_test.sql), so the owner can update this column through the existing
-- profiles_update_own policy.

alter table public.profiles
  add column has_seen_nav_tour boolean not null default false;

update public.profiles set has_seen_nav_tour = true;

comment on column public.profiles.has_seen_nav_tour is
  'Whether this account has completed or skipped the one-time guided tour of the main nav. Set once by the client when the tour finishes or is skipped; never reset.';
