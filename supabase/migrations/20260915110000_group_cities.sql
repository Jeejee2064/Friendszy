-- Villes où un groupe est "visible" (nouvelle table many-to-many), pour
-- permettre à quelqu'un qui ne sait pas quel type de groupe il cherche de
-- feuilleter les groupes de sa ville. `groups`, `group_members`, etc. ont
-- été créées à la main dans Supabase Studio (voir CLAUDE.md) — cette
-- migration se contente d'AJOUTER un nouvel objet qui les référence, elle
-- ne redéfinit rien d'existant.
--
-- Comme `cities` (20260914140000_cities_catalogue.sql), la lecture est
-- publique (un groupe est déjà listable par tout le monde via groups_select,
-- inconditionnelle — voir le commentaire au-dessus de getMemberCountsByGroup
-- dans src/lib/groups/queries.ts) ; l'écriture est réservée aux
-- admins/créateur du groupe via is_group_admin(), déjà utilisée ailleurs
-- pour ce même rôle (RLS de group_message_reactions,
-- 20260914130000_message_reply_and_reactions.sql).
create table public.group_cities (
  group_id uuid not null references public.groups(id) on delete cascade,
  city_id integer not null references public.cities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, city_id)
);

create index group_cities_city_id_idx on public.group_cities(city_id);

alter table public.group_cities enable row level security;

create policy group_cities_select on public.group_cities
  for select
  using (true);

create policy group_cities_insert on public.group_cities
  for insert
  with check (is_group_admin(group_id));

create policy group_cities_delete on public.group_cities
  for delete
  using (is_group_admin(group_id));

-- GRANT obligatoire en plus du RLS (voir CLAUDE.md) — sans ça, RLS n'est
-- jamais évalué et tout accès échoue en 42501.
grant select, insert, delete on public.group_cities to authenticated;
