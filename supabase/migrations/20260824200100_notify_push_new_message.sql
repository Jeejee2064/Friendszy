-- Fires the push-new-message Edge Function whenever a new_message
-- notification row is inserted, i.e. it piggybacks on the notify_new_message
-- trigger on `messages` (see 20260824200200_notify_new_message.sql) instead
-- of adding a second independent trigger on `messages` itself — one source
-- of truth for "a new message happened", per the client's explicit
-- instruction. (The client described this notify_new_message trigger as
-- already live; a direct check against production found it didn't actually
-- exist yet, so 20260824200200 builds it for real — apply that migration
-- too, this one is inert without it.)
--
-- pg_net lets Postgres make an async outbound HTTP call without blocking
-- the triggering transaction. The Edge Function URL and the shared secret
-- used to authenticate this call are deliberately NOT in this file (it's
-- committed to git) — they live in Supabase Vault, set once manually via
-- the SQL editor after this migration is applied:
--
--   select vault.create_secret('https://<project-ref>.functions.supabase.co/push-new-message', 'push_edge_function_url');
--   select vault.create_secret('<a random 32+ byte secret>', 'push_trigger_secret');
--
-- The same push_trigger_secret value must also be set as an Edge Function
-- secret (`supabase secrets set PUSH_TRIGGER_SECRET=...`) so the function
-- can check the header this trigger sends and reject any request that
-- doesn't carry it — the function URL is otherwise a public, unauthenticated
-- endpoint. See supabase/functions/push-new-message/ and the handoff notes
-- for the full manual setup checklist (Vault secrets, pg_net check, VAPID
-- keys, function secrets, deploy).
--
-- Until those Vault secrets are set, this trigger is a harmless no-op — it
-- never blocks or fails the underlying notifications insert.

create extension if not exists pg_net with schema extensions;

create or replace function public.push_new_message_notify()
returns trigger
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
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-trigger-secret', v_secret
    ),
    body := jsonb_build_object(
      'notification_id', new.id,
      'user_id', new.user_id,
      'payload', new.payload
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

comment on function public.push_new_message_notify() is
  'AFTER INSERT ON notifications trigger (type = new_message only). Forwards the notification row to the push-new-message Edge Function via pg_net so it can send a Web Push to the recipient''s subscribed devices. Reads the target URL and an auth secret from Supabase Vault (never hardcoded here); silently no-ops if those secrets are not yet configured, so it can never block the in-app notification this rides on.';

create trigger trg_push_new_message
  after insert on public.notifications
  for each row
  when (new.type = 'new_message')
  execute function public.push_new_message_notify();
