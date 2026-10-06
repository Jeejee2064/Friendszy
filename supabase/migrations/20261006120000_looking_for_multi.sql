-- "Ce que je recherche" devient un choix multiple : looking_for passe de
-- text (un seul choix) à text[] (liste de valeurs de la même liste fermée).
-- Les valeurs existantes sont conservées (un tableau d'un élément).
-- looking_for_other reste la précision libre, utilisée seulement quand
-- 'other' fait partie des choix.
--
-- Pas de nouveau GRANT : UPDATE sur profiles est déjà accordé à
-- `authenticated`, la colonne garde le même nom.

alter table public.profiles drop constraint profiles_looking_for_check;

alter table public.profiles
  alter column looking_for type text[]
  using case when looking_for is null then '{}'::text[] else array[looking_for] end;

alter table public.profiles
  alter column looking_for set default '{}',
  alter column looking_for set not null;

alter table public.profiles
  add constraint profiles_looking_for_check check (
    cardinality(looking_for) <= 8
    and looking_for <@ array[
      'new_friends', 'sport_partner', 'outings', 'parent_friends',
      'online_chat', 'networking', 'game_partner', 'other'
    ]::text[]
  );
