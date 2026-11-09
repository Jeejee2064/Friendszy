-- Jetons FCM des appareils natifs (shell Capacitor Android). Table séparée
-- de push_subscriptions : un jeton FCM n'a ni clés p256dh/auth ni endpoint
-- Web Push. Écrite par le client (src/lib/push/native.ts), lue uniquement
-- par l'Edge Function push-new-message (service_role).

create table public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  locale text not null default 'fr',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint native_push_tokens_token_unique unique (token)
);

comment on table public.native_push_tokens is
  'Un jeton FCM par installation native. Unique sur token : si un autre compte se connecte sur le même appareil, le jeton est réassigné (upsert) à ce compte. Un jeton invalide (FCM UNREGISTERED/NOT_FOUND) est supprimé par l''Edge Function.';

create index idx_native_push_tokens_user_id on public.native_push_tokens(user_id);

alter table public.native_push_tokens enable row level security;

create policy native_push_tokens_select_own on public.native_push_tokens
  for select using (user_id = auth.uid());
create policy native_push_tokens_insert_own on public.native_push_tokens
  for insert with check (user_id = auth.uid());
create policy native_push_tokens_update_own on public.native_push_tokens
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy native_push_tokens_delete_own on public.native_push_tokens
  for delete using (user_id = auth.uid());

-- GRANT explicites (voir CLAUDE.md "Leçons apprises"). UPDATE requis pour
-- l'upsert côté client.
grant select, insert, update, delete on public.native_push_tokens to authenticated;
grant select, insert, update, delete on public.native_push_tokens to service_role;
