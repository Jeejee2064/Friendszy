-- Présence "je regarde cette conversation en ce moment" : sert uniquement à
-- ne pas envoyer de notification push pour un message alors que le
-- destinataire est déjà en train de lire cette conversation dans l'appli
-- (bug remonté par le client : la notif arrivait même en pleine
-- discussion). Le toast in-app reste géré séparément côté client
-- (src/lib/messages/unread-context.tsx compare directement la conversation
-- ouverte, sans passer par cette table) ; celle-ci n'est lue que par
-- l'Edge Function push-new-message (voir supabase/functions/push-new-message).
--
-- Une seule ligne par utilisateur (pas par conversation) : on ne regarde
-- qu'une conversation à la fois. Le client fait un heartbeat (upsert)
-- toutes les ~15s tant que la conversation reste ouverte à l'écran et
-- l'onglet visible, et supprime la ligne en quittant la conversation ou en
-- masquant l'onglet. updated_at sert de garde-fou : une ligne plus vieille
-- que la fenêtre de fraîcheur côté Edge Function (20s) est ignorée, pour
-- ne jamais bloquer les push si le nettoyage côté client n'a pas pu se
-- faire (onglet fermé brutalement, crash, etc.).

create table public.conversation_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create index conversation_presence_conversation_id_idx on public.conversation_presence(conversation_id);

comment on table public.conversation_presence is
  'Une ligne par utilisateur : la conversation qu''il regarde actuellement (heartbeat côté client). Lue par push-new-message pour éviter une notif push redondante ; updated_at périmé (>20s) = ignorée.';

alter table public.conversation_presence enable row level security;

-- GRANT explicite obligatoire en plus du RLS (leçon du projet, voir
-- CLAUDE.md) : une table créée par migration SQL brute n'a pas les
-- privilèges de base pour le rôle `authenticated` sans ça.
grant select, insert, update, delete on public.conversation_presence to authenticated;
-- service_role (l'Edge Function) n'a besoin que de lire.
grant select on public.conversation_presence to service_role;

-- Chacun ne gère que sa propre ligne, dans une conversation dont il est
-- bien participant (réutilise is_conversation_participant(), déjà utilisée
-- ailleurs pour messages/message_reactions).
create policy conversation_presence_select on public.conversation_presence
  for select
  to authenticated
  using (user_id = auth.uid());

create policy conversation_presence_insert on public.conversation_presence
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_active_user()
    and is_conversation_participant(conversation_id)
  );

create policy conversation_presence_update on public.conversation_presence
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and is_active_user()
    and is_conversation_participant(conversation_id)
  );

create policy conversation_presence_delete on public.conversation_presence
  for delete
  to authenticated
  using (user_id = auth.uid());
