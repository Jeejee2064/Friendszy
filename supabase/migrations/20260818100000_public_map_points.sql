-- Public landing page map (visiteur non connecté) — voir CLAUDE.md "pas de
-- policy RLS ouverte au rôle anon". Plutôt qu'une policy anon sur
-- events/partner_listings, ce SECURITY DEFINER retourne un jeu de colonnes
-- strictement limité (titre/nom, catégorie, ville, coordonnées, une seule
-- photo) — jamais la description complète, les compteurs d'inscrits, ou les
-- coordonnées de contact d'un partenaire (téléphone/site/adresse), même si
-- l'appelant (anon) n'a par ailleurs aucun accès direct à ces tables.
--
-- Même rationale que get_event_registration_counts/get_group_member_counts :
-- SECURITY DEFINER traverse RLS pour renvoyer uniquement un résultat agrégé/
-- restreint, jamais les lignes brutes.
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
  category_label_en text
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
    i.label_en as category_label_en
  from public.events e
  join public.interests i on i.id = e.interest_id
  where e.ends_at >= now()
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
    i.label_en as category_label_en
  from public.partner_listings pl
  join public.interests i on i.id = pl.interest_id
  where pl.status = 'active'
    and pl.latitude is not null
    and pl.longitude is not null;
$$;

comment on function public.get_public_map_points() is
  'Public landing page (visiteur non connecté) map data. Strictly limited columns — no description, no registration counts, no partner contact info. SECURITY DEFINER so it needs no anon RLS policy on events/partner_listings themselves.';

grant execute on function public.get_public_map_points() to anon, authenticated;
