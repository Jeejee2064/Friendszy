-- The "existing new_message notification trigger" this project's client
-- code has been quietly written for (src/lib/notifications/queries.ts
-- filters `.neq("type", "new_message")`, notifications-page-client.tsx
-- skips it) turns out NOT to exist live — checked directly against
-- production: 10 rows in `messages`, zero `notifications` rows of type
-- `new_message`. It was anticipated but never built. This migration builds
-- it for real, so that the push trigger (20260824200100_notify_push_new_message.sql)
-- has something to piggyback on, as originally intended — one source of
-- truth for "a new message happened", not two.
--
-- payload is deliberately minimal and stable: { sender_id, conversation_id }
-- — exactly what push-new-message/index.ts reads, no more.

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
    jsonb_build_object('sender_id', new.sender_id, 'conversation_id', new.conversation_id)
  );

  return new;
end;
$$;

comment on function public.notify_new_message() is
  'AFTER INSERT ON messages. Inserts a notifications row (type = new_message) for the OTHER participant in the conversation. In-app UI deliberately keeps filtering this type out of the bell/list (see src/lib/notifications/queries.ts) — its only current consumer is the push trigger in 20260824200100_notify_push_new_message.sql.';

create trigger trg_notify_new_message
  after insert on public.messages
  for each row
  execute function public.notify_new_message();
