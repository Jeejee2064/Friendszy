-- Cities catalogue, managed by admins from /admin/cities — same purpose as
-- the interests catalogue (see 20260831120000_interests_admin_write.sql) but
-- without a user-facing suggestion workflow: admins add missing cities
-- directly, there's no pending/approved suggestion queue for this one.
--
-- profiles.city (and events.city, partner_listings.city, home_city, the
-- temporary-city destination) all stay free text — this table only backs the
-- CityAutocomplete suggestion list, it is not a foreign key target. Existing
-- free-text values are untouched and still work with match_city_ids() etc.
-- regardless of what is or isn't in this table.
create table public.cities (
  id serial primary key,
  name text not null,
  created_at timestamptz not null default now()
);

-- Case/accent-insensitive uniqueness (unaccent is already installed, see
-- has_extension('unaccent', ...) in supabase/tests/db_test.sql) so "Montreal"
-- and "Montréal" can't both be added — matches normalizeForSearch(), the
-- same rule CityAutocomplete's client-side filtering already uses.
--
-- unaccent(text) itself is STABLE, not IMMUTABLE (Postgres can't prove it
-- doesn't depend on search_path/the dictionary in use), so it's rejected
-- directly in an index expression (42P17). This wrapper declares itself
-- IMMUTABLE instead — safe in practice since the 'unaccent' dictionary this
-- project uses never changes at runtime.
--
-- `language plpgsql` (not `sql`) is deliberate: a `language sql` wrapper
-- gets inlined by the planner, which would splice the inner (still STABLE)
-- unaccent() call directly into the index expression and bring back 42P17
-- — plpgsql bodies are opaque to the planner, so our own IMMUTABLE label is
-- what actually gets trusted. `set search_path = public` matches the one
-- other function in this project that already calls unaccent()
-- successfully (handle_interest_suggestion_resolution, see
-- 20260910120000_add_spanish_locale.sql) — resolving it via an explicit,
-- fixed search_path rather than whatever the caller's happens to be is
-- also the safer pattern for a SECURITY DEFINER-adjacent index function.
create or replace function public.immutable_unaccent(text)
returns text
language plpgsql
immutable
parallel safe
set search_path = public
as $$
begin
  return unaccent($1);
end;
$$;

create unique index cities_name_unique_idx on public.cities (lower(public.immutable_unaccent(name)));

alter table public.cities enable row level security;

create policy cities_select on public.cities
  for select
  using (true);

create policy cities_insert_admin on public.cities
  for insert
  with check (is_admin());

create policy cities_update_admin on public.cities
  for update
  using (is_admin())
  with check (is_admin());

create policy cities_delete_admin on public.cities
  for delete
  using (is_admin());

-- GRANT is separate from RLS (see CLAUDE.md) — without it, RLS is never even
-- evaluated and every access fails with 42501 regardless of the policies
-- above.
grant select on public.cities to authenticated;
grant insert, update, delete on public.cities to authenticated;
grant usage, select on sequence public.cities_id_seq to authenticated;

-- Seed with the list previously hardcoded in src/lib/search/cities.ts
-- (CITY_SUGGESTIONS) so switching CityAutocomplete over to this table loses
-- no city already offered. On conflict matches the unique index above.
insert into public.cities (name) values
    ('Montréal'),
    ('Québec'),
    ('Laval'),
    ('Gatineau'),
    ('Longueuil'),
    ('Sherbrooke'),
    ('Saguenay'),
    ('Lévis'),
    ('Trois-Rivières'),
    ('Terrebonne'),
    ('Saint-Jean-sur-Richelieu'),
    ('Repentigny'),
    ('Drummondville'),
    ('Saint-Jérôme'),
    ('Granby'),
    ('Blainville'),
    ('Shawinigan'),
    ('Dollard-des-Ormeaux'),
    ('Rimouski'),
    ('Châteauguay'),
    ('Acton Vale'),
    ('Alma'),
    ('Amos'),
    ('Amqui'),
    ('Baie-Comeau'),
    ('Baie-D''Urfé'),
    ('Baie-Saint-Paul'),
    ('Barkmere'),
    ('Beaconsfield'),
    ('Beauceville'),
    ('Beauharnois'),
    ('Beaupré'),
    ('Bécancour'),
    ('Bedford'),
    ('Belleterre'),
    ('Belœil'),
    ('Berthierville'),
    ('Boisbriand'),
    ('Bois-des-Filion'),
    ('Bonaventure'),
    ('Boucherville'),
    ('Bromont'),
    ('Brossard'),
    ('Brownsburg-Chatham'),
    ('Candiac'),
    ('Cap-Chat'),
    ('Cap-Santé'),
    ('Carignan'),
    ('Carleton-sur-Mer'),
    ('Causapscal'),
    ('Chambly'),
    ('Chandler'),
    ('Chapais'),
    ('Charlemagne'),
    ('Château-Richer'),
    ('Chibougamau'),
    ('Clermont'),
    ('Coaticook'),
    ('Contrecœur'),
    ('Cookshire-Eaton'),
    ('Coteau-du-Lac'),
    ('Côte-Saint-Luc'),
    ('Cowansville'),
    ('Danville'),
    ('Daveluyville'),
    ('Dégelis'),
    ('Delson'),
    ('Desbiens'),
    ('Deux-Montagnes'),
    ('Disraeli'),
    ('Dolbeau-Mistassini'),
    ('Donnacona'),
    ('Dorval'),
    ('Dunham'),
    ('Duparquet'),
    ('East Angus'),
    ('Estérel'),
    ('Farnham'),
    ('Fermont'),
    ('Forestville'),
    ('Fossambault-sur-le-Lac'),
    ('Gaspé'),
    ('Gracefield'),
    ('Grande-Rivière'),
    ('Hampstead'),
    ('Hudson'),
    ('Huntingdon'),
    ('Joliette'),
    ('Kingsey Falls'),
    ('Kirkland'),
    ('L''Ancienne-Lorette'),
    ('L''Assomption'),
    ('L''Épiphanie'),
    ('L''Île-Cadieux'),
    ('L''Île-Dorval'),
    ('L''Île-Perrot'),
    ('Lac-Brome'),
    ('Lac-Delage'),
    ('Lachute'),
    ('Lac-des-Aigles'),
    ('Lac-Mégantic'),
    ('Lac-Saint-Joseph'),
    ('Lac-Sergent'),
    ('La Malbaie'),
    ('La Pocatière'),
    ('La Prairie'),
    ('La Sarre'),
    ('La Tuque'),
    ('Lavaltrie'),
    ('Lebel-sur-Quévillon'),
    ('Léry'),
    ('Lorraine'),
    ('Louiseville'),
    ('Macamic'),
    ('Magog'),
    ('Malartic'),
    ('Maniwaki'),
    ('Marieville'),
    ('Mascouche'),
    ('Matagami'),
    ('Matane'),
    ('McMasterville'),
    ('Mercier'),
    ('Métabetchouan–Lac-à-la-Croix'),
    ('Métis-sur-Mer'),
    ('Mirabel'),
    ('Mont-Joli'),
    ('Mont-Laurier'),
    ('Montmagny'),
    ('Montréal-Est'),
    ('Montréal-Ouest'),
    ('Mont-Royal'),
    ('Mont-Saint-Hilaire'),
    ('Mont-Tremblant'),
    ('Murdochville'),
    ('Neuville'),
    ('New Richmond'),
    ('Nicolet'),
    ('Normandin'),
    ('Notre-Dame-de-l''Île-Perrot'),
    ('Notre-Dame-des-Prairies'),
    ('Otterburn Park'),
    ('Paspébiac'),
    ('Percé'),
    ('Pincourt'),
    ('Plessisville'),
    ('Pohénégamook'),
    ('Pointe-Claire'),
    ('Pont-Rouge'),
    ('Port-Cartier'),
    ('Portneuf'),
    ('Prévost'),
    ('Princeville'),
    ('Richelieu'),
    ('Richmond'),
    ('Rigaud'),
    ('Rivière-du-Loup'),
    ('Rivière-Rouge'),
    ('Roberval'),
    ('Rosemère'),
    ('Rouyn-Noranda'),
    ('Saint-Amable'),
    ('Saint-Antonin'),
    ('Saint-Augustin-de-Desmaures'),
    ('Saint-Basile'),
    ('Saint-Basile-le-Grand'),
    ('Saint-Bruno-de-Montarville'),
    ('Saint-Césaire'),
    ('Saint-Charles-Borromée'),
    ('Saint-Colomban'),
    ('Saint-Constant'),
    ('Sainte-Adèle'),
    ('Sainte-Agathe-des-Monts'),
    ('Sainte-Anne-de-Beaupré'),
    ('Sainte-Anne-de-Bellevue'),
    ('Sainte-Anne-des-Monts'),
    ('Sainte-Anne-des-Plaines'),
    ('Sainte-Brigitte-de-Laval'),
    ('Sainte-Catherine'),
    ('Sainte-Catherine-de-la-Jacques-Cartier'),
    ('Sainte-Julie'),
    ('Sainte-Marguerite-du-Lac-Masson'),
    ('Sainte-Marie'),
    ('Sainte-Marthe-sur-le-Lac'),
    ('Sainte-Thérèse'),
    ('Saint-Eustache'),
    ('Saint-Félicien'),
    ('Saint-Gabriel'),
    ('Saint-Georges'),
    ('Saint-Honoré'),
    ('Saint-Hyacinthe'),
    ('Saint-Joseph-de-Beauce'),
    ('Saint-Joseph-de-Sorel'),
    ('Saint-Lambert'),
    ('Saint-Lazare'),
    ('Saint-Lin–Laurentides'),
    ('Saint-Marc-des-Carrières'),
    ('Saint-Ours'),
    ('Saint-Pamphile'),
    ('Saint-Pascal'),
    ('Saint-Philippe'),
    ('Saint-Pie'),
    ('Saint-Raymond'),
    ('Saint-Rémi'),
    ('Saint-Sauveur'),
    ('Saint-Tite'),
    ('Saint-Zotique'),
    ('Salaberry-de-Valleyfield'),
    ('Schefferville'),
    ('Scotstown'),
    ('Senneterre'),
    ('Sept-Îles'),
    ('Shannon'),
    ('Sorel-Tracy'),
    ('Stanstead'),
    ('Sutton'),
    ('Témiscaming'),
    ('Témiscouata-sur-le-Lac'),
    ('Thetford Mines'),
    ('Thurso'),
    ('Trois-Pistoles'),
    ('Valcourt'),
    ('Val-d''Or'),
    ('Val-des-Sources'),
    ('Varennes'),
    ('Vaudreuil-Dorion'),
    ('Victoriaville'),
    ('Ville-Marie'),
    ('Warwick'),
    ('Waterloo'),
    ('Waterville'),
    ('Westmount'),
    ('Windsor'),
    ('Ottawa'),
    ('Toronto'),
    ('Vancouver'),
    ('Calgary'),
    ('Halifax')
on conflict (lower(public.immutable_unaccent(name))) do nothing;
