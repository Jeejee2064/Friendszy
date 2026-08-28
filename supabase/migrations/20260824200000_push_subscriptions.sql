-- Web Push subscriptions: one row per device/browser a user has granted
-- notification permission on, storing what the browser's PushManager
-- returned (endpoint + encryption keys). Delivery is trigger-driven — see
-- the companion migration 20260824200100_notify_push_new_message.sql,
-- which calls the push-new-message Edge Function whenever the existing
-- new_message notification trigger fires. This migration only creates the
-- storage table; it does not send anything.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  locale text not null default 'fr',
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  constraint push_subscriptions_user_endpoint_unique unique (user_id, endpoint)
);

comment on table public.push_subscriptions is
  'One row per browser/device PushManager subscription. Written by the client (src/lib/push/subscribe.ts) on permission grant; read only by the push-new-message Edge Function (service_role) to deliver Web Push. A dead/expired subscription (push service returns 404/410) is deleted by that function rather than left to accumulate.';
comment on column public.push_subscriptions.locale is
  'fr or en, captured client-side from next-intl useLocale() at subscribe time. Lets the Edge Function render notification text in the right language and build a correctly locale-prefixed deep link without needing a browser i18n context (localePrefix: "as-needed" means fr URLs have no prefix, en URLs do — see src/i18n/routing.ts).';
comment on column public.push_subscriptions.last_used_at is
  'Bumped by the Edge Function after each successful send. Not read by anything yet — kept for future stale-subscription cleanup/debugging.';

create index idx_push_subscriptions_user_id on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_select_own on public.push_subscriptions
  for select
  using (user_id = auth.uid());

create policy push_subscriptions_insert_own on public.push_subscriptions
  for insert
  with check (user_id = auth.uid());

create policy push_subscriptions_delete_own on public.push_subscriptions
  for delete
  using (user_id = auth.uid());

-- No update policy for authenticated: the client re-subscribes via upsert
-- (insert ... on conflict (user_id, endpoint)) rather than updating a row
-- in place. service_role (the Edge Function) still gets UPDATE via the
-- GRANT below, to bump last_used_at — it bypasses RLS entirely anyway.

-- GRANT obligatoire (voir CLAUDE.md "Leçons apprises") : une table créée
-- par migration SQL brute n'a par défaut AUCUN privilège pour
-- authenticated/service_role, contrairement à une table créée depuis
-- Supabase Studio. Sans ce GRANT, tout accès échoue en 42501 avant même
-- que RLS soit évalué.
grant select, insert, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;
