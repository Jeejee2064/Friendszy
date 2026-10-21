-- « Partenaire de… » : looking_for ne dit plus « partenaire de sport » mais
-- « partenaire d'activité », et le membre précise pour quels intérêts il
-- cherche un partenaire (ex. Moto, Randonnée). Ces intérêts vivent dans leur
-- propre table, distincte de profile_interests : avoir un intérêt ne veut pas
-- dire chercher un partenaire pour celui-ci.
--
-- Même forme et même RLS que event_interests (visible sur un profil pour toute
-- personne non bloquée). Suppression en cascade avec le profil et l'intérêt.

-- 1. Renommage de la valeur sport_partner -> activity_partner
alter table public.profiles drop constraint profiles_looking_for_check;

update public.profiles
  set looking_for = array_replace(looking_for, 'sport_partner', 'activity_partner')
  where 'sport_partner' = any(looking_for);

alter table public.profiles
  add constraint profiles_looking_for_check check (
    cardinality(looking_for) <= 8
    and looking_for <@ array[
      'new_friends', 'activity_partner', 'outings', 'parent_friends',
      'online_chat', 'networking', 'game_partner', 'other'
    ]::text[]
  );

-- 2. Intérêts pour lesquels on cherche un partenaire
create table public.profile_partner_interests (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  interest_id integer not null references public.interests(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, interest_id)
);

create index profile_partner_interests_interest_id_idx
  on public.profile_partner_interests(interest_id);

alter table public.profile_partner_interests enable row level security;

create policy profile_partner_interests_select on public.profile_partner_interests
  for select
  to authenticated
  using (not is_blocked_between(auth.uid(), profile_id));

create policy profile_partner_interests_insert_own on public.profile_partner_interests
  for insert
  to authenticated
  with check (is_active_user() and profile_id = auth.uid());

create policy profile_partner_interests_delete_own on public.profile_partner_interests
  for delete
  to authenticated
  using (profile_id = auth.uid());

grant select, insert, delete on public.profile_partner_interests to authenticated;
grant select, insert, delete on public.profile_partner_interests to service_role;

-- 3. Plafond de 5 intérêts par profil
create or replace function public.enforce_partner_interests_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*) from public.profile_partner_interests
    where profile_id = new.profile_id
  ) >= 5 then
    raise exception 'partner_interests_limit' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profile_partner_interests_limit
  before insert on public.profile_partner_interests
  for each row execute function public.enforce_partner_interests_limit();
