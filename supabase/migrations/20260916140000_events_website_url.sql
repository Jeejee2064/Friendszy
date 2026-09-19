-- Optional link to the event's official website/page, shown as a clickable
-- link on the event detail page. Nullable, additive — no RLS change needed,
-- the existing events_insert/events_update policies already govern the row.
alter table public.events
  add column website_url text
  check (website_url is null or website_url ~* '^https?://');
