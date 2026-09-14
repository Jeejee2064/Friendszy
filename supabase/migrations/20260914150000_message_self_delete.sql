-- Permet à l'auteur d'un message de le retirer lui-même (retrait doux,
-- même mécanisme que le retrait admin déjà en place pour les groupes/
-- événements : removed_at/removed_by posés, contenu conservé en base mais
-- masqué côté UI). Avant cette migration, seul un admin/créateur de
-- groupe/organisateur d'événement pouvait retirer un message de groupe/
-- événement, et AUCUN retrait n'existait pour les messages privés
-- (messages).
--
-- ATTENTION avant d'appliquer en prod : `messages` porte un trigger
-- d'immutabilité (enforce_message_immutability, mentionné dans CLAUDE.md)
-- qui n'est pas versionné ici (créé à la main côté Studio — même situation
-- que handle_interest_suggestion_resolution, voir
-- 20260831120000_interests_admin_write.sql). Si ce trigger conditionne le
-- droit de poser removed_at à is_admin() (ce que la description du projet
-- laisse penser : "Un admin peut poser removed_at/removed_by... mais
-- jamais changer le contenu"), la policy RLS ajoutée ici sera nécessaire
-- mais PAS suffisante — le trigger rejettera quand même la mise à jour
-- pour un non-admin, et il faudra l'assouplir en plus (son code n'est pas
-- disponible ici pour le faire à l'aveugle). À vérifier avant d'appliquer :
--   select pg_get_functiondef('public.enforce_message_immutability'::regproc);
-- Si le retrait par l'auteur échoue silencieusement après cette migration,
-- c'est très probablement ce trigger — partager sa définition pour l'ajuster.

-- Policies RLS additives : un utilisateur peut poser removed_at/removed_by
-- sur SON PROPRE message (les policies existantes — retrait admin/
-- créateur/organisateur — restent inchangées, Postgres évalue plusieurs
-- policies UPDATE en OR).

create policy messages_sender_remove on public.messages
  for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid() and removed_by = auth.uid());

create policy group_messages_sender_remove on public.group_messages
  for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid() and removed_by = auth.uid());

create policy event_messages_sender_remove on public.event_messages
  for update
  to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid() and removed_by = auth.uid());

-- Défense en profondeur : une policy RLS ne restreint pas QUELLES colonnes
-- changent, seulement QUELLES LIGNES sont accessibles. Ce trigger garantit
-- qu'un non-admin ne peut jamais, via UPDATE, toucher à autre chose que
-- removed_at/removed_by — en particulier jamais content, dont
-- l'immutabilité est un engagement du produit (voir CLAUDE.md). Il
-- complète (sans le remplacer) l'éventuel trigger existant sur `messages`
-- — un trigger ne peut que restreindre davantage, jamais lever une
-- restriction posée ailleurs, voir l'avertissement en tête de fichier —
-- et couvre en plus group_messages/event_messages, qui n'avaient jusqu'ici
-- aucune garantie équivalente documentée. `removed_by` doit toujours être
-- l'appelant lui-même : c'est déjà le cas aussi bien pour le retrait par
-- l'auteur (ce trigger) que pour le retrait admin/créateur/organisateur
-- existant (removeGroupMessage/removeEventMessage passent toujours l'id de
-- l'appelant), donc cette règle ne casse pas ce flux-là.

create or replace function public.enforce_messages_self_remove_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if new.content is distinct from old.content
    or new.sender_id is distinct from old.sender_id
    or new.conversation_id is distinct from old.conversation_id
  then
    raise exception 'only removed_at/removed_by may be changed by a non-admin';
  end if;

  if new.removed_at is distinct from old.removed_at or new.removed_by is distinct from old.removed_by then
    if old.removed_at is not null then
      raise exception 'message already removed';
    end if;
    if new.removed_by is distinct from auth.uid() then
      raise exception 'removed_by must be the current user';
    end if;
  end if;

  return new;
end;
$$;

create trigger messages_self_remove_only
  before update on public.messages
  for each row execute function public.enforce_messages_self_remove_only();

create or replace function public.enforce_group_messages_self_remove_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if new.content is distinct from old.content
    or new.sender_id is distinct from old.sender_id
    or new.group_id is distinct from old.group_id
  then
    raise exception 'only removed_at/removed_by may be changed by a non-admin';
  end if;

  if new.removed_at is distinct from old.removed_at or new.removed_by is distinct from old.removed_by then
    if old.removed_at is not null then
      raise exception 'message already removed';
    end if;
    if new.removed_by is distinct from auth.uid() then
      raise exception 'removed_by must be the current user';
    end if;
  end if;

  return new;
end;
$$;

create trigger group_messages_self_remove_only
  before update on public.group_messages
  for each row execute function public.enforce_group_messages_self_remove_only();

create or replace function public.enforce_event_messages_self_remove_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if is_admin() then
    return new;
  end if;

  if new.content is distinct from old.content
    or new.sender_id is distinct from old.sender_id
    or new.event_id is distinct from old.event_id
  then
    raise exception 'only removed_at/removed_by may be changed by a non-admin';
  end if;

  if new.removed_at is distinct from old.removed_at or new.removed_by is distinct from old.removed_by then
    if old.removed_at is not null then
      raise exception 'message already removed';
    end if;
    if new.removed_by is distinct from auth.uid() then
      raise exception 'removed_by must be the current user';
    end if;
  end if;

  return new;
end;
$$;

create trigger event_messages_self_remove_only
  before update on public.event_messages
  for each row execute function public.enforce_event_messages_self_remove_only();
