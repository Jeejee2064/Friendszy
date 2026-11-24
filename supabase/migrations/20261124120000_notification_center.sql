-- Centre de notifications unifié.
--
-- 1. notification_preferences : une ligne par utilisateur (catégories push +
--    heures calmes). Absence de ligne = tout activé, pas d'heures calmes.
-- 2. chat_presence : « je regarde ce chat de groupe / d'événement en ce
--    moment » (pendant de conversation_presence pour les messages privés),
--    lue par l'Edge Function pour ne pas pousser une notif redondante.
-- 3. Le push n'est plus réservé à new_message : le trigger sur notifications
--    couvre tous les types, et deux nouveaux triggers couvrent les messages
--    de groupe et d'événement (sans créer une ligne notifications par
--    membre, qui noierait la liste).
-- 4. notify_new_message() ajoute message_id au payload (le client s'en sert
--    pour accuser la réception sans écouter tous les INSERT de messages).
--
-- Dépend de pg_net et des secrets Vault déjà posés pour
-- 20260824200100_notify_push_new_message.sql (push_edge_function_url,
-- push_trigger_secret). Sans eux, les triggers restent des no-op.

-- ---------------------------------------------------------------------------
-- 1. Préférences
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_messages boolean not null default true,
  push_social boolean not null default true,
  push_groups boolean not null default true,
  push_events boolean not null default true,
  quiet_start time,
  quiet_end time,
  timezone text not null default 'America/Toronto',
  updated_at timestamptz not null default now(),
  -- Heures calmes : les deux bornes ou aucune.
  constraint notification_preferences_quiet_pair
    check ((quiet_start is null) = (quiet_end is null))
);

comment on table public.notification_preferences is
  'Préférences push par catégorie + heures calmes (fuseau timezone). Pas de ligne = tout activé. Lue par l''Edge Function push-new-message (service_role) et par le client.';

alter table public.notification_preferences enable row level security;

create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.notification_preferences to service_role;

-- ---------------------------------------------------------------------------
-- 2. Présence dans les chats de groupe / d'événement
-- ---------------------------------------------------------------------------
create table public.chat_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('group', 'event')),
  target_id uuid not null,
  updated_at timestamptz not null default now()
);

comment on table public.chat_presence is
  'Une ligne par utilisateur : le chat de groupe ou d''événement qu''il regarde (heartbeat client ~15 s). updated_at > 20 s = ignorée. Pas de FK sur target_id (groups ou events selon kind).';

alter table public.chat_presence enable row level security;

create policy chat_presence_select_own on public.chat_presence
  for select to authenticated using (user_id = auth.uid());
create policy chat_presence_insert_own on public.chat_presence
  for insert to authenticated with check (user_id = auth.uid() and is_active_user());
create policy chat_presence_update_own on public.chat_presence
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy chat_presence_delete_own on public.chat_presence
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.chat_presence to authenticated;
grant select on public.chat_presence to service_role;

-- ---------------------------------------------------------------------------
-- 3. Triggers de push
-- ---------------------------------------------------------------------------
create or replace function public.push_dispatch(p_body jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'push_edge_function_url';
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'push_trigger_secret';

  if v_url is null or v_secret is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-trigger-secret', v_secret
    ),
    body := p_body,
    timeout_milliseconds := 5000
  );
exception when others then
  -- Le push ne doit jamais faire échouer l'écriture qui l'a déclenché.
  null;
end;
$$;

revoke all on function public.push_dispatch(jsonb) from public, anon, authenticated;

-- Remplace le trigger limité à new_message : tous les types passent, sauf
-- ceux qui n'ont aucun sens côté push.
create or replace function public.push_new_message_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_dispatch(jsonb_build_object(
    'kind', 'notification',
    'notification_id', new.id,
    'type', new.type,
    'user_id', new.user_id,
    'payload', new.payload
  ));
  return new;
end;
$$;

comment on function public.push_new_message_notify() is
  'AFTER INSERT ON notifications : transmet la ligne à l''Edge Function push-new-message (tous les types ; l''Edge Function applique préférences, heures calmes et présence).';

drop trigger if exists trg_push_new_message on public.notifications;
create trigger trg_push_notification
  after insert on public.notifications
  for each row
  execute function public.push_new_message_notify();

create or replace function public.push_group_message_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_dispatch(jsonb_build_object(
    'kind', 'group_message',
    'message_id', new.id,
    'group_id', new.group_id,
    'sender_id', new.sender_id
  ));
  return new;
end;
$$;

create trigger trg_push_group_message
  after insert on public.group_messages
  for each row
  execute function public.push_group_message_notify();

create or replace function public.push_event_message_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_dispatch(jsonb_build_object(
    'kind', 'event_message',
    'message_id', new.id,
    'event_id', new.event_id,
    'sender_id', new.sender_id
  ));
  return new;
end;
$$;

create trigger trg_push_event_message
  after insert on public.event_messages
  for each row
  execute function public.push_event_message_notify();

-- ---------------------------------------------------------------------------
-- 4. new_message : message_id dans le payload
-- ---------------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
begin
  select case when c.user_a = new.sender_id then c.user_b else c.user_a end
    into v_recipient
    from public.conversations c
    where c.id = new.conversation_id;

  if v_recipient is null then
    return new;
  end if;

  insert into public.notifications (user_id, type, payload)
  values (
    v_recipient,
    'new_message',
    jsonb_build_object(
      'sender_id', new.sender_id,
      'conversation_id', new.conversation_id,
      'message_id', new.id
    )
  );

  return new;
end;
$$;
