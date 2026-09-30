-- Date de fin « indéterminée » : ends_at devient nullable.
-- events_dates_check (ends_at >= starts_at) reste valable : un CHECK laisse passer NULL.
-- Un événement sans date de fin est considéré comme terminé 24 h après son début
-- (même règle côté app, voir src/lib/events/queries.ts).

alter table public.events alter column ends_at drop not null;

-- Même forme de retour que la version précédente : create or replace suffit.
create or replace function public.get_public_map_points()
returns table (
  kind text,
  id uuid,
  title text,
  city text,
  latitude double precision,
  longitude double precision,
  photo_url text,
  category_emoji text,
  category_label_fr text,
  category_label_en text,
  category_label_es text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    'event'::text as kind,
    e.id,
    e.title,
    e.city,
    e.latitude,
    e.longitude,
    (
      select ep.url from public.event_photos ep
      where ep.event_id = e.id
      order by ep.position
      limit 1
    ) as photo_url,
    i.emoji as category_emoji,
    i.label_fr as category_label_fr,
    i.label_en as category_label_en,
    i.label_es as category_label_es
  from public.events e
  join public.interests i on i.id = e.interest_id
  where coalesce(e.ends_at, e.starts_at + interval '1 day') >= now()
    and e.latitude is not null
    and e.longitude is not null

  union all

  select
    'partner'::text as kind,
    pl.id,
    pl.name as title,
    pl.city,
    pl.latitude,
    pl.longitude,
    pl.photo_urls[1] as photo_url,
    i.emoji as category_emoji,
    i.label_fr as category_label_fr,
    i.label_en as category_label_en,
    i.label_es as category_label_es
  from public.partner_listings pl
  join public.interests i on i.id = pl.interest_id
  where pl.status = 'active'
    and pl.latitude is not null
    and pl.longitude is not null;
$$;

grant execute on function public.get_public_map_points() to anon, authenticated;
