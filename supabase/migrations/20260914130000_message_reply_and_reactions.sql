-- Réponse à un message + réactions emoji rapides, sur les 3 surfaces de
-- chat existantes (messages privés, groupes, événements). Chaque surface a
-- déjà sa propre table de messages (messages / group_messages /
-- event_messages) sans relation entre elles — on suit le même découpage
-- plutôt que d'introduire une table polymorphe : reply_to_id est
-- auto-référencé par table, et chaque table de messages reçoit sa propre
-- table de réactions.

-- Répondre à un message ------------------------------------------------------

alter table public.messages
  add column reply_to_id uuid references public.messages(id) on delete set null;
alter table public.group_messages
  add column reply_to_id uuid references public.group_messages(id) on delete set null;
alter table public.event_messages
  add column reply_to_id uuid references public.event_messages(id) on delete set null;

create index messages_reply_to_id_idx on public.messages(reply_to_id);
create index group_messages_reply_to_id_idx on public.group_messages(reply_to_id);
create index event_messages_reply_to_id_idx on public.event_messages(reply_to_id);

comment on column public.messages.reply_to_id is
  'Message auquel celui-ci répond (même conversation, voir trigger messages_reply_same_conversation), null sinon.';
comment on column public.group_messages.reply_to_id is
  'Message auquel celui-ci répond (même groupe, voir trigger group_messages_reply_same_group), null sinon.';
comment on column public.event_messages.reply_to_id is
  'Message auquel celui-ci répond (même événement, voir trigger event_messages_reply_same_event), null sinon.';

-- Un client malveillant pourrait autrement pointer reply_to_id vers un
-- message d'une AUTRE conversation/groupe/événement (RLS l'empêche de le
-- lire, mais pas de le référencer) — ces triggers garantissent que la
-- citation reste toujours interne à la même discussion.

create or replace function public.enforce_messages_reply_same_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.messages
    where id = new.reply_to_id and conversation_id = new.conversation_id
  ) then
    raise exception 'reply_to_id must belong to the same conversation';
  end if;
  return new;
end;
$$;

create trigger messages_reply_same_conversation
  before insert on public.messages
  for each row execute function public.enforce_messages_reply_same_conversation();

create or replace function public.enforce_group_messages_reply_same_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.group_messages
    where id = new.reply_to_id and group_id = new.group_id
  ) then
    raise exception 'reply_to_id must belong to the same group';
  end if;
  return new;
end;
$$;

create trigger group_messages_reply_same_group
  before insert on public.group_messages
  for each row execute function public.enforce_group_messages_reply_same_group();

create or replace function public.enforce_event_messages_reply_same_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.event_messages
    where id = new.reply_to_id and event_id = new.event_id
  ) then
    raise exception 'reply_to_id must belong to the same event';
  end if;
  return new;
end;
$$;

create trigger event_messages_reply_same_event
  before insert on public.event_messages
  for each row execute function public.enforce_event_messages_reply_same_event();

-- Réactions emoji rapides -----------------------------------------------------
--
-- Une seule réaction active par personne et par message (comportement
-- WhatsApp/Messenger) : choisir un nouvel emoji remplace le précédent
-- (UPDATE), re-choisir le même le retire (DELETE côté client) — d'où la
-- contrainte unique (message_id, user_id) plutôt que (message_id, user_id,
-- emoji). Le jeu d'emojis est volontairement restreint par un CHECK ; passer
-- à des emojis libres nécessiterait de lever cette contrainte plus tard.
--
-- conversation_id / group_id / event_id sont dénormalisés (et posés
-- serveur, jamais par le client — voir triggers ci-dessous) pour permettre
-- policies RLS et filtres Realtime simples, sur le même modèle que
-- messages.conversation_id.

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '😂', '❤️', '😮', '🔥')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index message_reactions_message_id_idx on public.message_reactions(message_id);
create index message_reactions_conversation_id_idx on public.message_reactions(conversation_id);

create table public.group_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.group_messages(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '😂', '❤️', '😮', '🔥')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index group_message_reactions_message_id_idx on public.group_message_reactions(message_id);
create index group_message_reactions_group_id_idx on public.group_message_reactions(group_id);

create table public.event_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.event_messages(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '😂', '❤️', '😮', '🔥')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index event_message_reactions_message_id_idx on public.event_message_reactions(message_id);
create index event_message_reactions_event_id_idx on public.event_message_reactions(event_id);

create or replace function public.set_message_reaction_conversation_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select conversation_id into new.conversation_id
  from public.messages where id = new.message_id;
  if new.conversation_id is null then
    raise exception 'message_id does not reference an existing message';
  end if;
  return new;
end;
$$;

create trigger message_reactions_set_conversation_id
  before insert on public.message_reactions
  for each row execute function public.set_message_reaction_conversation_id();

create or replace function public.set_group_message_reaction_group_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select group_id into new.group_id
  from public.group_messages where id = new.message_id;
  if new.group_id is null then
    raise exception 'message_id does not reference an existing group message';
  end if;
  return new;
end;
$$;

create trigger group_message_reactions_set_group_id
  before insert on public.group_message_reactions
  for each row execute function public.set_group_message_reaction_group_id();

create or replace function public.set_event_message_reaction_event_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select event_id into new.event_id
  from public.event_messages where id = new.message_id;
  if new.event_id is null then
    raise exception 'message_id does not reference an existing event message';
  end if;
  return new;
end;
$$;

create trigger event_message_reactions_set_event_id
  before insert on public.event_message_reactions
  for each row execute function public.set_event_message_reaction_event_id();

alter table public.message_reactions enable row level security;
alter table public.group_message_reactions enable row level security;
alter table public.event_message_reactions enable row level security;

-- Realtime DELETE events only carry the primary key in `old` unless the
-- table's replica identity includes the rest of the row — and the client
-- panes filter their reaction subscriptions on conversation_id/group_id/
-- event_id (not the primary key), so without this a removed reaction would
-- never reach other open tabs/devices until their next reconnect.
alter table public.message_reactions replica identity full;
alter table public.group_message_reactions replica identity full;
alter table public.event_message_reactions replica identity full;

-- GRANT explicite obligatoire en plus du RLS (leçon du projet, voir
-- CLAUDE.md) : une table créée par migration SQL brute n'a pas les
-- privilèges de base pour le rôle `authenticated` sans ça.
grant select, insert, update, delete on public.message_reactions to authenticated;
grant select, insert, update, delete on public.message_reactions to service_role;
grant select, insert, update, delete on public.group_message_reactions to authenticated;
grant select, insert, update, delete on public.group_message_reactions to service_role;
grant select, insert, update, delete on public.event_message_reactions to authenticated;
grant select, insert, update, delete on public.event_message_reactions to service_role;

-- messages : réutilise is_conversation_participant() / is_active_user(),
-- déjà utilisées ailleurs pour cette table.

create policy message_reactions_select on public.message_reactions
  for select
  to authenticated
  using (is_conversation_participant(conversation_id));

create policy message_reactions_insert on public.message_reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_active_user()
    and is_conversation_participant(conversation_id)
  );

create policy message_reactions_update on public.message_reactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and is_active_user()
    and is_conversation_participant(conversation_id)
  );

create policy message_reactions_delete on public.message_reactions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- group_messages : réutilise is_group_member().

create policy group_message_reactions_select on public.group_message_reactions
  for select
  to authenticated
  using (is_group_member(group_id));

create policy group_message_reactions_insert on public.group_message_reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_active_user()
    and is_group_member(group_id)
  );

create policy group_message_reactions_update on public.group_message_reactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and is_active_user()
    and is_group_member(group_id)
  );

create policy group_message_reactions_delete on public.group_message_reactions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- event_messages : réutilise is_event_participant() / is_event_organizer()
-- (un organisateur n'est pas forcément inscrit comme participant).

create policy event_message_reactions_select on public.event_message_reactions
  for select
  to authenticated
  using (is_event_participant(event_id) or is_event_organizer(event_id));

create policy event_message_reactions_insert on public.event_message_reactions
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_active_user()
    and (is_event_participant(event_id) or is_event_organizer(event_id))
  );

create policy event_message_reactions_update on public.event_message_reactions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and is_active_user()
    and (is_event_participant(event_id) or is_event_organizer(event_id))
  );

create policy event_message_reactions_delete on public.event_message_reactions
  for delete
  to authenticated
  using (user_id = auth.uid());
