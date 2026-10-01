-- Interest categories become admin-managed data instead of 11 keys hardcoded
-- in the app (CATEGORY_ORDER in InterestsGrid/GroupInterestSelect, the
-- InterestCategories message namespace, and a CHECK constraint on
-- interest_suggestions.category).
--
-- interests.category and interest_suggestions.category stay plain text
-- holding the category's slug — no foreign key, same loose coupling as
-- cities (see 20260914140000_cities_catalogue.sql). The admin UI refuses to
-- delete a category still used by an interest, and never edits a slug.
create table public.interest_categories (
  slug text primary key check (slug ~ '^[a-z0-9_]+$'),
  label_fr text not null,
  label_en text not null,
  label_es text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.interest_categories enable row level security;

create policy interest_categories_select on public.interest_categories
  for select
  using (true);

create policy interest_categories_insert_admin on public.interest_categories
  for insert
  with check (is_admin());

create policy interest_categories_update_admin on public.interest_categories
  for update
  using (is_admin())
  with check (is_admin());

create policy interest_categories_delete_admin on public.interest_categories
  for delete
  using (is_admin());

-- GRANT is separate from RLS (see CLAUDE.md).
grant select on public.interest_categories to anon, authenticated;
grant insert, update, delete on public.interest_categories to authenticated;

insert into public.interest_categories (slug, label_fr, label_en, label_es, sort_order) values
  ('sports', 'Sports', 'Sports', 'Deportes', 10),
  ('plein_air', 'Plein air', 'Outdoors', 'Aire libre', 20),
  ('arts_creatifs', 'Arts créatifs', 'Creative arts', 'Artes creativas', 30),
  ('jeux', 'Jeux', 'Games', 'Juegos', 40),
  ('lecture', 'Lecture', 'Reading', 'Lectura', 50),
  ('cinema_culture_pop', 'Cinéma & culture pop', 'Movies & pop culture', 'Cine y cultura pop', 60),
  ('genres_musicaux', 'Genres musicaux', 'Music genres', 'Géneros musicales', 70),
  ('instruments_musique', 'Instruments de musique', 'Musical instruments', 'Instrumentos musicales', 80),
  ('cuisine', 'Cuisine', 'Cooking', 'Cocina', 90),
  ('bien_etre', 'Bien-être', 'Wellness', 'Bienestar', 100),
  ('autre', 'Autre', 'Other', 'Otro', 1000)
on conflict (slug) do nothing;

-- Free-form category slugs are now allowed on suggestions (users pick from
-- the table, admins can add rows). Constraint name per the comment in
-- 20260922100000_add_other_interest.sql; created in Studio, hence IF EXISTS.
alter table public.interest_suggestions
  drop constraint if exists interest_suggestions_category_check;
