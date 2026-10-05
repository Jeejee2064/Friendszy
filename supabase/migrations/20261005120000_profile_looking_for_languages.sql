-- "Ce que je recherche" + langues parlées sur le profil.
--
-- looking_for : un seul choix parmi une liste fermée (menu déroulant).
-- looking_for_other : précision libre, utilisée seulement quand
-- looking_for = 'autre'.
-- languages : codes ISO 639-1 (fr, en, es, ...) — le nom affiché est
-- localisé côté client (Intl.DisplayNames), donc rien à traduire en base.
--
-- Pas de nouveau GRANT : `authenticated` a déjà UPDATE sur profiles (les
-- colonnes sensibles sont verrouillées séparément, voir
-- 20260818090000_profiles_has_seen_nav_tour.sql) et ces colonnes sont
-- modifiables par l'utilisateur lui-même, comme bio/city.

alter table public.profiles
  add column looking_for text,
  add column looking_for_other text,
  add column languages text[] not null default '{}';

alter table public.profiles
  add constraint profiles_looking_for_check check (
    looking_for is null or looking_for in (
      'new_friends', 'sport_partner', 'outings', 'parent_friends',
      'online_chat', 'networking', 'game_partner', 'other'
    )
  ),
  add constraint profiles_looking_for_other_check check (
    looking_for_other is null or char_length(looking_for_other) <= 100
  ),
  add constraint profiles_languages_check check (cardinality(languages) <= 10);
