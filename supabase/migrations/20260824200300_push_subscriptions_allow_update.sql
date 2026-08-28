-- Missing GRANT + RLS policy, found live via a disposable test account:
-- the client's subscribe flow (src/lib/push/subscribe.ts) upserts —
-- insert ... on conflict (user_id, endpoint) do update — to stay
-- idempotent on repeat subscribe calls from the same device. Postgres
-- requires UPDATE privilege (and a matching RLS policy) for the
-- conflict-resolution branch of an upsert, even though the statement is
-- logically an insert. The original migration
-- (20260824200000_push_subscriptions.sql) only granted select/insert/delete
-- to authenticated, reasoning "the client re-subscribes via upsert rather
-- than updating in place" — true in intent, wrong about what upsert
-- actually requires under the hood. Every real subscribe attempt was
-- failing with 42501 "permission denied for table push_subscriptions"
-- as a result, silently swallowed by subscribeToPush()'s catch.

grant update on public.push_subscriptions to authenticated;

create policy push_subscriptions_update_own on public.push_subscriptions
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
