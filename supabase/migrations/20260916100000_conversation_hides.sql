-- Masquage d'une conversation "pour moi seulement" (bouton Supprimer dans la
-- liste de messagerie, src/app/[locale]/(app)/messages/). Ne touche ni
-- `conversations` ni `messages` : la conversation et tout son historique
-- restent intacts en base pour les deux participants.
--
-- Une ligne = "cet utilisateur a masqué cette conversation à hidden_at".
-- listConversations() (src/lib/messages/queries.ts) l'exclut de la liste
-- tant qu'aucun message plus récent que hidden_at n'existe. Dès que
-- conversations.last_message_at dépasse hidden_at (message envoyé ou reçu,
-- peu importe qui écrit en premier), la conversation réapparaît d'elle-même
-- avec tout l'historique — sans qu'il soit nécessaire de supprimer cette
-- ligne ni d'y toucher autrement qu'en la remasquant plus tard.

create table public.conversation_hides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

create index conversation_hides_conversation_id_idx on public.conversation_hides(conversation_id);

comment on table public.conversation_hides is
  'Une ligne = cet utilisateur a masqué cette conversation de sa liste à hidden_at. La conversation et ses messages restent intacts ; elle réapparaît d''elle-même dès qu''un message plus récent que hidden_at existe (voir listConversations()).';

alter table public.conversation_hides enable row level security;

-- GRANT explicite obligatoire en plus du RLS (leçon du projet, voir
-- CLAUDE.md) : une table créée par migration SQL brute n'a pas les
-- privilèges de base pour le rôle `authenticated` sans ça.
grant select, insert, update, delete on public.conversation_hides to authenticated;

-- Chacun ne gère que sa propre ligne, dans une conversation dont il est bien
-- participant (réutilise is_conversation_participant(), déjà utilisée
-- ailleurs pour messages/message_reactions/conversation_presence).
create policy conversation_hides_select on public.conversation_hides
  for select
  to authenticated
  using (user_id = auth.uid());

create policy conversation_hides_insert on public.conversation_hides
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_active_user()
    and is_conversation_participant(conversation_id)
  );

-- Update sert au upsert de hideConversation() : masquer à nouveau une
-- conversation déjà masquée ne fait que rafraîchir hidden_at.
create policy conversation_hides_update on public.conversation_hides
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and is_active_user()
    and is_conversation_participant(conversation_id)
  );

create policy conversation_hides_delete on public.conversation_hides
  for delete
  to authenticated
  using (user_id = auth.uid());
