-- First-party, self-hosted behavioural analytics (v1 scope: authenticated
-- users only — no anonymous/pre-signup tracking, see the tracking plan).
-- One row per product event (onboarding funnel, search mode, PWA install,
-- push opt-in, ...), captured client-side via src/lib/analytics/track.ts,
-- gated on Loi 25 cookie consent (src/lib/consent/cookie-consent.ts). Read
-- only by the admin dashboard's Analytics tab. Immutable, same philosophy
-- as "messages figés" — no update policy/grant for anyone.

create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.analytics_events is
  'Self-hosted product analytics events (onboarding funnel, search mode, PWA install, push opt-in, ...). Written by the authenticated user themselves (src/lib/analytics/track.ts), read only by admins (Analytics tab). Deleted automatically when the profile is deleted (Loi 25 erasure) via the FK cascade.';
comment on column public.analytics_events.properties is
  'Small, event-specific JSON payload — see the AnalyticsEventName catalogue in src/lib/analytics/events.ts for the shape expected per event_name.';

create index idx_analytics_events_event_name_created_at
  on public.analytics_events (event_name, created_at desc);
create index idx_analytics_events_user_id on public.analytics_events (user_id);

alter table public.analytics_events enable row level security;

-- Users can only log their own events, never read/update/delete anything.
create policy analytics_events_insert_own on public.analytics_events
  for insert
  with check (user_id = auth.uid());

-- Admins can read everything; nobody else gets a select policy at all.
create policy analytics_events_select_admin on public.analytics_events
  for select
  using (is_admin());

-- GRANT obligatoire (voir CLAUDE.md "Leçons apprises") : une table créée
-- par migration SQL brute n'a par défaut AUCUN privilège pour
-- authenticated/service_role, contrairement à une table créée depuis
-- Supabase Studio. Sans ce GRANT, tout accès échoue en 42501 avant même
-- que RLS soit évalué.
grant select, insert on public.analytics_events to authenticated;
grant select, insert on public.analytics_events to service_role;
