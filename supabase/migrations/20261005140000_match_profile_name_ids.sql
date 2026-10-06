-- Recherche par nom insensible aux accents et à la casse ("Kloe" trouve "Kloé").
-- Le filtre ilike de PostgREST ne peut pas appliquer unaccent() sur une colonne,
-- donc la comparaison se fait ici (même approche que match_city_ids).
-- SECURITY INVOKER (défaut) : le RLS de profiles s'applique toujours.
create or replace function public.match_profile_name_ids(p_tokens text[])
returns table (id uuid)
language sql
stable
set search_path = public, extensions
as $$
  select p.id
  from public.profiles p
  where not exists (
    select 1
    from unnest(p_tokens) as t(token)
    where not (
      public.immutable_unaccent(lower(coalesce(p.full_name, ''))) like '%' || public.immutable_unaccent(lower(t.token)) || '%'
      or public.immutable_unaccent(lower(coalesce(p.last_name, ''))) like '%' || public.immutable_unaccent(lower(t.token)) || '%'
      or (
        cardinality(p_tokens) = 1
        and public.immutable_unaccent(lower(coalesce(p.username, ''))) like '%' || public.immutable_unaccent(lower(t.token)) || '%'
      )
    )
  );
$$;

grant execute on function public.match_profile_name_ids(text[]) to authenticated;
