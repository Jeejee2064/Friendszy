-- Photos supplémentaires du profil (jusqu'à 3, en plus de l'avatar),
-- visibles sur le profil (soi-même et profil public). Table dédiée +
-- trigger de limite, sur le modèle d'event_photos/enforce_event_photos_limit.
--
-- Stockage : réutilise le bucket "avatars" existant, dossier
-- avatars/{profile_id}/... — déjà couvert par les policies storage.objects
-- avatars_insert_own_folder / avatars_update_own / avatars_delete_own /
-- avatars_select (scope = premier segment du chemin = auth.uid()). Aucune
-- policy de storage supplémentaire n'est donc nécessaire.
create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index idx_profile_photos_profile on public.profile_photos(profile_id);

alter table public.profile_photos enable row level security;

-- GRANT explicite obligatoire en plus du RLS (leçon du projet, voir CLAUDE.md) :
-- une table créée par migration SQL brute n'a pas les privilèges de base pour
-- le rôle `authenticated` sans ça.
grant select, insert, delete on public.profile_photos to authenticated;
grant select, insert, update, delete on public.profile_photos to service_role;

-- Visibilité alignée sur profiles_select/profiles_select_admin : les mêmes
-- règles de blocage s'appliquent aux photos supplémentaires qu'au profil.
create policy profile_photos_select on public.profile_photos
  for select
  to authenticated
  using (not is_blocked_between(auth.uid(), profile_id));

create policy profile_photos_select_admin on public.profile_photos
  for select
  to authenticated
  using (is_admin());

create policy profile_photos_insert on public.profile_photos
  for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy profile_photos_delete on public.profile_photos
  for delete
  to authenticated
  using (profile_id = auth.uid() or is_admin());

create or replace function public.enforce_profile_photos_limit()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if (select count(*) from public.profile_photos where profile_id = new.profile_id) >= 3 then
    raise exception 'A profile cannot have more than 3 extra photos';
  end if;
  return new;
end;
$$;

create trigger enforce_profile_photos_limit
  before insert on public.profile_photos
  for each row execute function public.enforce_profile_photos_limit();
