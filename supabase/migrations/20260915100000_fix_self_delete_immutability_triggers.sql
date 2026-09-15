-- Corrige le retrait de son propre message (20260914150000_message_self_delete.sql),
-- cassé en prod pour les messages privés et les messages de groupe.
--
-- Diagnostic (voir l'avertissement laissé dans 20260914150000) : les
-- policies RLS ajoutées par cette migration étaient nécessaires mais pas
-- suffisantes — deux triggers d'immutabilité non versionnés (créés à la
-- main côté Studio, jamais suivis ici, même situation que
-- handle_interest_suggestion_resolution) rejettent encore la mise à jour
-- avant qu'elle n'atteigne la table :
--
--   - protect_message_immutability (messages) : bloque TOUT changement de
--     removed_at/removed_by pour un non-admin, quelle que soit la policy
--     qui a autorisé la ligne. Un utilisateur normal qui retire son propre
--     message privé se prend "Un message envoyé ne peut pas être modifié."
--   - protect_group_message_immutability (group_messages) : encore plus
--     strict, bloque TOUTE mise à jour venant d'un non-admin du groupe,
--     point final. Un membre normal (ni créateur ni admin) ne peut retirer
--     aucun message, y compris le sien.
--
-- protect_event_message_immutability (event_messages) n'a pas ce problème
-- (il n'interdit que de "dé-retirer" un message déjà retiré) — pas touché
-- ici, laissé tel quel comme référence du comportement voulu.
--
-- Le fix : on remplace la logique "admin vs non-admin" par une règle
-- uniforme, sur le modèle de event_messages — le contenu original
-- (content/sender_id/conversation_id-ou-group_id/created_at) reste
-- immuable pour TOUT LE MONDE, y compris un admin (déjà le cas avant), et
-- removed_at/removed_by peuvent être posés une fois (par qui que ce soit
-- que les policies RLS laissent passer — auteur pour son propre message,
-- admin/créateur/organisateur sinon) mais plus jamais changés une fois
-- posés. Qui a le droit de poser cette première valeur reste entièrement
-- décidé par les policies RLS (messages_sender_remove, messages_update_admin,
-- group_messages_sender_remove, group_messages_update_admin, etc.) — ce
-- trigger ne fait que protéger les colonnes, jamais les lignes.

create or replace function public.protect_message_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.content is distinct from old.content
     or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Un message envoyé ne peut pas être modifié.';
  end if;

  if old.removed_at is not null
     and (new.removed_at is distinct from old.removed_at
          or new.removed_by is distinct from old.removed_by) then
    raise exception 'Un message retiré ne peut pas être modifié à nouveau.';
  end if;

  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Le statut de lecture ne peut pas être annulé.';
  end if;

  if old.delivered_at is not null and new.delivered_at is distinct from old.delivered_at then
    raise exception 'Le statut de livraison ne peut pas être annulé.';
  end if;

  return new;
end;
$$;

create or replace function public.protect_group_message_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.content is distinct from old.content
     or new.sender_id is distinct from old.sender_id
     or new.group_id is distinct from old.group_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Un message de groupe envoyé ne peut pas être modifié.';
  end if;

  if old.removed_at is not null
     and (new.removed_at is distinct from old.removed_at
          or new.removed_by is distinct from old.removed_by) then
    raise exception 'Un message de groupe retiré ne peut pas être modifié à nouveau.';
  end if;

  return new;
end;
$$;
