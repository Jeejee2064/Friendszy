-- Le floutage de set_map_location() dérivait son décalage de hashtext(user_id)
-- et d'une formule visible dans le dépôt : n'importe qui pouvait recalculer le
-- décalage (l'id d'un profil est public) et retrouver la position exacte à
-- partir de la position floutée lue via profile_locations_select.
-- Le décalage vient maintenant d'une graine aléatoire par utilisateur, stockée
-- dans une table sans aucun privilège pour anon/authenticated (lue seulement
-- par la fonction SECURITY DEFINER).
--
-- NOTE : les positions déjà stockées ont été floutées avec l'ancienne formule
-- (réversible). Elles ne sont pas touchées par cette migration ; les
-- remettre à zéro (visible_to_others = false, latitude/longitude = null) est
-- une décision à prendre à part.

create table public.profile_location_secrets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  blur_seed bigint not null default (floor(random() * 9007199254740991))::bigint
);

alter table public.profile_location_secrets enable row level security;
-- Volontairement aucune policy ni GRANT pour anon/authenticated.
revoke all on public.profile_location_secrets from anon, authenticated;
grant select, insert, update, delete on public.profile_location_secrets to service_role;

create or replace function public.set_map_location(p_latitude double precision, p_longitude double precision)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seed bigint;
  v_angle double precision;
  v_radius_deg double precision;
  v_lng_scale double precision;
begin
  if not is_active_user() then
    raise exception 'Account not active';
  end if;
  if p_latitude is null or p_longitude is null
     or p_latitude < -90 or p_latitude > 90
     or p_longitude < -180 or p_longitude > 180 then
    raise exception 'Invalid coordinates';
  end if;

  insert into public.profile_location_secrets (profile_id)
  values (auth.uid())
  on conflict (profile_id) do nothing;

  select blur_seed into v_seed
    from public.profile_location_secrets where profile_id = auth.uid();

  v_angle := (v_seed % 360) * pi() / 180;
  v_radius_deg := 0.00135 + ((v_seed / 360) % 100) / 100.0 * 0.00135;
  v_lng_scale := greatest(cos(radians(p_latitude)), 0.01);

  insert into public.profile_locations (profile_id, visible_to_others, latitude, longitude, updated_at)
  values (
    auth.uid(),
    true,
    p_latitude + v_radius_deg * cos(v_angle),
    p_longitude + (v_radius_deg * sin(v_angle)) / v_lng_scale,
    now()
  )
  on conflict (profile_id) do update
  set visible_to_others = true,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      updated_at = excluded.updated_at;
end;
$$;

grant execute on function public.set_map_location(double precision, double precision) to authenticated;
