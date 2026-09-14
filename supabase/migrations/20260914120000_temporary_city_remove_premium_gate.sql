-- Retire temporairement l'exigence "plan premium" de set_temporary_city().
-- Rien n'est premium pour l'instant (Stripe pas branché, voir CLAUDE.md —
-- profiles.plan reste 'free' pour tout le monde jusqu'au lancement de
-- l'abonnement en Phase 2), donc ce contrôle ne faisait que bloquer tout le
-- monde sans raison. Signature et reste du corps inchangés par rapport à
-- 20260913120000_temporary_city_date_range.sql — seul le bloc
-- "v_plan is distinct from 'premium'" disparaît. Remettre ce contrôle (et
-- la sélection de v_plan ci-dessous) une fois l'abonnement réellement
-- branché ; le champ profiles.plan lui-même n'est pas touché.
create or replace function public.set_temporary_city(p_city text, p_from timestamptz, p_until timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
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

  select temporary_city_until into v_current_until
  from public.profiles where id = v_uid for update;

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
  'Planifie/active un séjour temporaire (arrivée p_from, départ p_until) pour l''utilisateur courant. Contrôle "plan premium" retiré temporairement (voir 20260914120000_temporary_city_remove_premium_gate.sql) — à réintroduire une fois l''abonnement branché. Snapshot profiles.city dans home_city si aucun séjour n''est déjà en cours ; n''écrit profiles.city que si l''arrivée est déjà passée, sinon laisse activate_due_temporary_cities() le faire à l''heure dite.';
