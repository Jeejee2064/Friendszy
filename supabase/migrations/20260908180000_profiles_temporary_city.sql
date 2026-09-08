-- Ville temporaire : permet à un utilisateur Premium de se rendre visible
-- dans une autre ville que la sienne pour une durée limitée (ex. il est de
-- passage à Québec pour la semaine et veut être trouvé par les gens qui y
-- sont). `profiles.city` reste la colonne "effective" lue partout ailleurs
-- dans le code (match_city_ids, cartes de profil, Search/Discover) — donc
-- aucun changement requis sur ce qui existe déjà. `home_city` +
-- `temporary_city_until` ne servent qu'à savoir qu'un séjour temporaire est
-- en cours et à quelle ville revenir une fois terminé.
--
-- Écriture protégée par privilège de colonne plutôt que par un trigger
-- dédié : `authenticated` a déjà UPDATE au niveau table sur profiles
-- (comportement documenté dans 20260818090000_profiles_has_seen_nav_tour.sql),
-- donc on retire spécifiquement ces deux colonnes de ce privilège plus bas.
-- Elles ne sont alors modifiables que par set_temporary_city()/
-- clear_temporary_city() ci-dessous (SECURITY DEFINER, donc s'exécutent
-- avec les privilèges du propriétaire de la fonction, pas ceux de
-- l'appelant) ou par service_role. Ça évite qu'un utilisateur free
-- contourne le contrôle de plan en appelant directement l'API REST sur ces
-- colonnes.

alter table public.profiles
  add column home_city text,
  add column temporary_city_until timestamptz;

comment on column public.profiles.home_city is
  'Snapshot de profiles.city pris au moment où set_temporary_city() est appelée la première fois (séjour non déjà en cours) — sert uniquement à restaurer la ville d''origine quand le séjour temporaire se termine (clear_temporary_city() ou retour automatique à l''expiration). N''a pas de sens hors d''un séjour temporaire actif.';
comment on column public.profiles.temporary_city_until is
  'Non-null tant qu''une ville temporaire (profiles.city) est active ; date/heure à laquelle le retour automatique à home_city doit avoir lieu. Modifiable uniquement via set_temporary_city()/clear_temporary_city() (voir REVOKE plus bas) — jamais en écriture directe par le client.';

revoke update (home_city, temporary_city_until) on public.profiles from authenticated;

-- Active un séjour temporaire. Réservé au plan premium (le plan freemium
-- n'est pas encore branché — voir CLAUDE.md — donc tant que profiles.plan
-- vaut 'free' pour tout le monde, cette fonction refusera systématiquement
-- l'activation ; c'est voulu, pas un bug).
create or replace function public.set_temporary_city(p_city text, p_until timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan text;
  v_current_until timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not is_active_user() then
    raise exception 'account_not_active';
  end if;

  if p_city is null or btrim(p_city) = '' then
    raise exception 'city_required';
  end if;

  -- Bornes défensives : l'UI propose 24h/3j/7j/14j, mais cette fonction est
  -- un point d'entrée public (RPC) et ne doit pas faire confiance à l'appelant.
  if p_until is null or p_until <= now() or p_until > now() + interval '30 days' then
    raise exception 'invalid_until';
  end if;

  select plan, temporary_city_until into v_plan, v_current_until
  from public.profiles where id = v_uid for update;

  if v_plan is distinct from 'premium' then
    raise exception 'temporary_city_requires_premium';
  end if;

  update public.profiles
  set
    -- Ne prendre le snapshot que si aucun séjour n'est déjà en cours :
    -- changer de destination en cours de route ne doit pas écraser
    -- home_city avec la ville temporaire actuelle.
    home_city = case
      when v_current_until is null or v_current_until <= now() then city
      else home_city
    end,
    city = btrim(p_city),
    temporary_city_until = p_until
  where id = v_uid;
end;
$$;

comment on function public.set_temporary_city(text, timestamptz) is
  'Active/prolonge un séjour temporaire pour l''utilisateur courant (plan premium requis). Snapshot profiles.city dans home_city si aucun séjour n''est déjà en cours, puis écrit la ville temporaire + son expiration.';

-- Retour manuel à la ville d'origine, avant l'expiration.
create or replace function public.clear_temporary_city()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
  set
    city = coalesce(home_city, city),
    temporary_city_until = null
  where id = v_uid and temporary_city_until is not null;
end;
$$;

comment on function public.clear_temporary_city() is
  'Termine le séjour temporaire en cours pour l''utilisateur courant et restaure home_city dans city. No-op si aucun séjour n''est actif.';

grant execute on function public.set_temporary_city(text, timestamptz) to authenticated;
grant execute on function public.clear_temporary_city() to authenticated;

-- Retour automatique à l'expiration, pour que la visibilité des *autres*
-- utilisateurs se corrige même si la personne de passage ne rouvre pas
-- l'app après la date de fin (un simple recheck côté client à la connexion
-- ne suffirait pas : ça ne corrigerait que sa propre session, pas ce que
-- les autres voient pendant son absence).
create or replace function public.revert_expired_temporary_cities()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set city = coalesce(home_city, city), temporary_city_until = null
  where temporary_city_until is not null and temporary_city_until <= now();
$$;

comment on function public.revert_expired_temporary_cities() is
  'Appelée par pg_cron (voir schedule ci-dessous) : restaure home_city pour tout profil dont le séjour temporaire a expiré. Idempotent.';

-- Nécessite l'extension pg_cron activée sur le projet Supabase. À vérifier
-- après application de cette migration (Database → Extensions dans le
-- dashboard, ou `create extension` échoue explicitement si indisponible) —
-- sur certains projets elle doit être activée manuellement une première
-- fois avant qu'une migration puisse s'y fier.
create extension if not exists pg_cron with schema cron;

select cron.schedule(
  'revert-expired-temporary-cities',
  '*/15 * * * *',
  $$select public.revert_expired_temporary_cities();$$
);
