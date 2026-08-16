-- Richer partner showcase: logo, tagline, and structured opening hours.
--
-- No new GRANT needed: these are new columns on an already-granted table
-- (authenticated has INSERT/SELECT/UPDATE on partner_listings — see
-- supabase/tests/db_test.sql "Grants" section) — GRANT is table-level, not
-- column-level. No RLS change needed either: partner_listings_update
-- already lets the owner (or an admin) update any column that isn't in the
-- protected set enforced by enforce_partner_listing_sensitive_columns
-- (status/profile_id/created_at) — these three new columns are not in it.

alter table public.partner_listings
  add column logo_url text,
  add column tagline text,
  add column opening_hours jsonb;

alter table public.partner_listings
  add constraint partner_listings_tagline_check check (char_length(tagline) <= 140);

comment on column public.partner_listings.logo_url is
  'Square logo, distinct from photo_urls — uploaded to the same partner-photos bucket/folder.';

comment on column public.partner_listings.tagline is
  'Short one-line pitch shown on the card and detail page, capped at 140 chars.';

comment on column public.partner_listings.opening_hours is
  'Structured weekly hours, e.g. {"mon":[{"open":"09:00","close":"17:00"}],"tue":[]}. '
  'Keys are 3-letter lowercase day codes (mon..sun); an empty/absent array means closed '
  'that day; null means hours were never filled in. Written by the client, read to compute '
  '"open now" — no server-side validation of its shape beyond being valid jsonb.';
