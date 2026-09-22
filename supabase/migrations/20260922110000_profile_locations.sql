-- Partage de position sur la carte Découvrir : opt-in explicite, désactivé
-- par défaut (Loi 25 — minimisation des données), snapshot manuel déclenché
-- par l'utilisateur (pas de suivi en continu / watchPosition). La position
-- GPS brute envoyée par le client n'est jamais persistée telle quelle : un
-- floutage (~150-300 m), stable par utilisateur (dérivé d'un hash de son
-- id, jamais d'un tirage aléatoire à chaque appel), est appliqué côté
-- serveur avant stockage — ça évite qu'on retrouve l'adresse exacte de
-- quelqu'un, et qu'on puisse moyenner plusieurs lectures pour l'annuler.
--
-- "Se localiser seulement pour soi" (voir sa propre position sur la carte
-- sans être visible des autres) n'a besoin d'aucune colonne ni d'aucun
-- appel serveur : ce cas reste entièrement côté client (centrer la carte
-- sur la position du navigateur). Seul le mode "visible par les autres"
-- touche la base de données.
--
-- Table dédiée (comme profile_photos/push_subscriptions/beta_feedback)
-- plutôt que des colonnes sur `profiles` : `profiles_select` est une policy
-- pleine ligne ("not is_blocked_between(...)"), sans restriction par
-- colonne, et de nombreux endroits du code font `select("*")` sur son
-- propre profil (getMyProfile) — y ajouter des colonnes de position aurait
-- soit fui la position floutée à n'importe quel utilisateur non bloqué via
-- un simple select("*") sur un autre profil, soit (si on avait tenté un
-- `revoke select` par colonne pour l'empêcher) cassé tous ces select("*")
-- existants, y compris pour le propriétaire de son propre profil. Une table
-- séparée, avec sa propre policy select consciente de `visible_to_others`,
-- règle proprement les deux problèmes.

create table public.profile_locations (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  visible_to_others boolean not null default false,
  latitude double precision,
  longitude double precision,
  updated_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.profile_locations is
  'Position (floutée) partagée par un utilisateur sur la carte Découvrir. Une ligne par profil, créée au premier partage. visible_to_others faux par défaut (opt-in explicite, Loi 25). Écrite uniquement par set_map_location()/clear_map_location() (SECURITY DEFINER) — authenticated n''a aucun privilège INSERT/UPDATE direct sur cette table, pour garantir que le floutage de la position brute ne peut jamais être contourné.';
comment on column public.profile_locations.latitude is
  'Position approximative (floutée, jamais la position GPS exacte transmise par le client).';
comment on column public.profile_locations.updated_at is
  'Horodatage du dernier partage ("Me localiser", snapshot manuel) — pas de suivi en continu.';

alter table public.profile_locations enable row level security;

-- GRANT explicite obligatoire en plus du RLS (leçon du projet, voir
-- CLAUDE.md) : une table créée par migration SQL brute n'a pas les
-- privilèges de base pour `authenticated` sans ça. Seul SELECT est
-- accordé : aucun INSERT/UPDATE/DELETE direct, tout passe par les
-- fonctions SECURITY DEFINER ci-dessous.
grant select on public.profile_locations to authenticated;
grant select, insert, update, delete on public.profile_locations to service_role;

-- Visible par son propriétaire (pour afficher son propre état de partage),
-- et par les autres seulement quand la ligne a explicitement consenti
-- (visible_to_others), a une position enregistrée, appartient à un compte
-- actif, et qu'aucun blocage n'existe dans un sens ou l'autre.
create policy profile_locations_select on public.profile_locations
  for select
  to authenticated
  using (
    profile_id = auth.uid()
    or (
      visible_to_others
      and latitude is not null
      and not is_blocked_between(auth.uid(), profile_id)
      and exists (
        select 1 from public.profiles p
        where p.id = profile_id and p.moderation_status = 'active'
      )
    )
  );

-- Écrit/active le partage pour l'utilisateur courant. p_latitude/p_longitude
-- sont la position GPS *brute* du navigateur, reçue en argument mais jamais
-- persistée telle quelle : le floutage est appliqué ici, côté serveur, pour
-- qu'aucun chemin d'écriture ne puisse le contourner (authenticated n'a de
-- toute façon aucun privilège d'écriture direct sur la table). Active
-- visible_to_others et écrit la position dans la même transaction — évite
-- l'état incohérent d'un flux client en deux étapes (position enregistrée
-- mais consentement pas encore posé, ou l'inverse).
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

  -- Décalage stable par utilisateur (ne change pas d'un rafraîchissement à
  -- l'autre, contrairement à un tirage aléatoire par appel) réparti sur un
  -- cercle d'environ 150 à 300 m de rayon autour de la position reçue.
  v_seed := abs(hashtext(auth.uid()::text)::bigint);
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

comment on function public.set_map_location(double precision, double precision) is
  'Seul chemin d''écriture pour profile_locations quand l''utilisateur accepte d''être visible sur la carte — applique un floutage stable par utilisateur avant stockage, jamais la position GPS exacte reçue en argument.';

grant execute on function public.set_map_location(double precision, double precision) to authenticated;

-- Arrête le partage pour l'utilisateur courant : désactive visible_to_others
-- et efface la position, dans la même transaction, pour ne jamais garder
-- une position floutée obsolète associée à un consentement retiré.
create or replace function public.clear_map_location()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile_locations (profile_id, visible_to_others, latitude, longitude, updated_at)
  values (auth.uid(), false, null, null, null)
  on conflict (profile_id) do update
  set visible_to_others = false,
      latitude = null,
      longitude = null,
      updated_at = null;
end;
$$;

comment on function public.clear_map_location() is
  'Désactive visible_to_others et efface la position pour l''utilisateur courant.';

grant execute on function public.clear_map_location() to authenticated;

-- Positions (floutées) visibles sur la carte pour l'utilisateur courant,
-- jointes au nom/avatar du profil. SECURITY INVOKER (pas de "security
-- definer") : profile_locations_select ci-dessus, combinée à profiles_select
-- ("not is_blocked_between"), autorise déjà exactement les lignes voulues
-- pour l'appelant — pas besoin de traverser RLS ici, juste de packager la
-- requête pour le client.
create or replace function public.get_nearby_visible_profiles()
returns table (
  id uuid,
  full_name text,
  avatar_url text,
  latitude double precision,
  longitude double precision
)
language sql
stable
set search_path = public
as $$
  select p.id, p.full_name, p.avatar_url, pl.latitude, pl.longitude
  from public.profile_locations pl
  join public.profiles p on p.id = pl.profile_id
  where pl.profile_id <> auth.uid();
$$;

comment on function public.get_nearby_visible_profiles() is
  'Autres utilisateurs visibles sur la carte Découvrir pour l''appelant — SECURITY INVOKER, s''appuie entièrement sur profile_locations_select et profiles_select pour ne renvoyer que les lignes déjà autorisées par RLS.';

grant execute on function public.get_nearby_visible_profiles() to authenticated;
