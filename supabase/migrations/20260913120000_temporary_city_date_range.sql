-- Ville temporaire : remplace le sélecteur de durée préréglée (24h/3j/7j/
-- 14j) par de vraies dates d'arrivée/départ — voir
-- 20260908180000_profiles_temporary_city.sql pour le design d'origine.
--
-- Ça introduit un cas qui n'existait pas avant : un séjour peut être
-- PLANIFIÉ à l'avance (arrivée dans le futur), pas seulement activé
-- immédiatement. `profiles.city` reste la colonne "effective" lue partout
-- ailleurs, donc elle ne doit changer qu'à l'arrivée réelle — sinon la
-- personne apparaîtrait "de passage" dans une ville où elle n'est pas
-- encore. On a donc besoin d'un endroit où garder la destination en
-- attendant cette date : `temporary_city_destination`. `temporary_city_from`
-- porte la date d'arrivée elle-même.
alter table public.profiles
  add column temporary_city_from timestamptz,
  add column temporary_city_destination text;

comment on column public.profiles.temporary_city_from is
  'Date d''arrivée du séjour temporaire en cours ou planifié. Tant que now() < temporary_city_from, profiles.city n''a pas encore été basculée vers la destination (voir activate_due_temporary_cities()). Modifiable uniquement via set_temporary_city()/clear_temporary_city() (voir REVOKE plus bas) — jamais en écriture directe par le client.';
comment on column public.profiles.temporary_city_destination is
  'Ville visée par le séjour en cours ou planifié ; recopiée dans profiles.city une fois temporary_city_from atteinte. Reste renseignée après l''arrivée (jusqu''à clear_temporary_city()/expiration) pour qu''activate_due_temporary_cities() reste idempotent.';

revoke update (temporary_city_from, temporary_city_destination) on public.profiles from authenticated;

-- Remplace la fonction à 2 arguments (p_city, p_until) par une version à 3
-- arguments (p_city, p_from, p_until) — signature différente en PG, donc
-- l'ancienne doit être supprimée explicitement plutôt qu'écrasée par
-- create or replace.
drop function if exists public.set_temporary_city(text, timestamptz);

create or replace function public.set_temporary_city(p_city text, p_from timestamptz, p_until timestamptz)
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

  -- Bornes défensives : l'UI propose un sélecteur de dates, mais cette
  -- fonction est un point d'entrée public (RPC) et ne doit pas faire
  -- confiance à l'appelant. On tolère un peu de dérive dans le passé
  -- (choisir "aujourd'hui" reste valide même une fois l'heure passée) mais
  -- ni un départ avant l'arrivée, ni un séjour planifié trop loin, ni une
  -- durée de plus de 30 jours.
  if p_from is null or p_until is null or p_until <= p_from then
    raise exception 'invalid_dates';
  end if;
  if p_from < now() - interval '1 day' or p_from > now() + interval '90 days' then
    raise exception 'invalid_from';
  end if;
  if p_until > p_from + interval '30 days' then
    raise exception 'invalid_until';
  end if;

  select plan, temporary_city_until into v_plan, v_current_until
  from public.profiles where id = v_uid for update;

  if v_plan is distinct from 'premium' then
    raise exception 'temporary_city_requires_premium';
  end if;

  update public.profiles
  set
    -- Ne prendre le snapshot que si aucun séjour (actif ou planifié) n'est
    -- déjà en cours : changer de destination en cours de route ne doit pas
    -- écraser home_city avec la ville temporaire actuelle.
    home_city = case
      when v_current_until is null or v_current_until <= now() then city
      else home_city
    end,
    temporary_city_destination = btrim(p_city),
    temporary_city_from = p_from,
    temporary_city_until = p_until,
    -- N'applique la destination tout de suite que si l'arrivée est déjà
    -- là ; sinon activate_due_temporary_cities() (pg_cron) s'en chargera
    -- le moment venu.
    city = case when p_from <= now() then btrim(p_city) else city end
  where id = v_uid;
end;
$$;

comment on function public.set_temporary_city(text, timestamptz, timestamptz) is
  'Planifie/active un séjour temporaire (arrivée p_from, départ p_until) pour l''utilisateur courant (plan premium requis). Snapshot profiles.city dans home_city si aucun séjour n''est déjà en cours ; n''écrit profiles.city que si l''arrivée est déjà passée, sinon laisse activate_due_temporary_cities() le faire à l''heure dite.';

grant execute on function public.set_temporary_city(text, timestamptz, timestamptz) to authenticated;

-- clear_temporary_city() doit maintenant aussi annuler un séjour PLANIFIÉ
-- (pas encore arrivé, donc profiles.city n'a pas encore changé), pas
-- seulement un séjour déjà actif — et nettoyer les deux nouvelles colonnes.
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
    temporary_city_until = null,
    temporary_city_from = null,
    temporary_city_destination = null
  where id = v_uid and temporary_city_until is not null;
end;
$$;

comment on function public.clear_temporary_city() is
  'Termine (ou annule, s''il n''a pas encore commencé) le séjour temporaire de l''utilisateur courant et restaure home_city dans city. No-op si aucun séjour n''est actif ni planifié.';

-- Bascule profiles.city vers la destination une fois temporary_city_from
-- atteinte, pour les séjours planifiés à l'avance (voir set_temporary_city()
-- ci-dessus). Complète revert_expired_temporary_cities() (retour au départ)
-- — même raisonnement : la visibilité des *autres* doit se corriger même si
-- la personne de passage ne rouvre pas l'app pile à son arrivée.
create or replace function public.activate_due_temporary_cities()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set city = temporary_city_destination
  where temporary_city_destination is not null
    and temporary_city_from <= now()
    and temporary_city_until > now()
    and city is distinct from temporary_city_destination;
$$;

comment on function public.activate_due_temporary_cities() is
  'Appelée par pg_cron : bascule profiles.city vers temporary_city_destination pour tout séjour planifié dont l''arrivée est atteinte. Idempotent.';

-- revert_expired_temporary_cities() doit aussi nettoyer les deux nouvelles
-- colonnes, sans quoi elles resteraient renseignées (et pourraient tromper
-- un futur diff/lecture) après l'expiration.
create or replace function public.revert_expired_temporary_cities()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set
    city = coalesce(home_city, city),
    temporary_city_until = null,
    temporary_city_from = null,
    temporary_city_destination = null
  where temporary_city_until is not null and temporary_city_until <= now();
$$;

select cron.schedule(
  'activate-due-temporary-cities',
  '*/15 * * * *',
  $$select public.activate_due_temporary_cities();$$
);
