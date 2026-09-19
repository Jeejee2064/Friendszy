-- "Intéressé" — a lighter, separate signal from event_registrations
-- (registering = going, counts toward capacity, unlocks chat). Kept in its
-- own table so it never interacts with enforce_event_registration_capacity
-- or is_event_participant()/is_event_organizer(). Mirrors profile_interests'
-- shape and RLS pattern (visible on a profile to anyone not blocked).
create table public.event_interests (
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

create index event_interests_profile_id_idx on public.event_interests(profile_id);

alter table public.event_interests enable row level security;

create policy event_interests_select on public.event_interests
  for select
  to authenticated
  using (not is_blocked_between(auth.uid(), profile_id));

create policy event_interests_insert_own on public.event_interests
  for insert
  to authenticated
  with check (is_active_user() and profile_id = auth.uid());

create policy event_interests_delete_own on public.event_interests
  for delete
  to authenticated
  using (profile_id = auth.uid());

grant select, insert, delete on public.event_interests to authenticated;
grant select, insert, delete on public.event_interests to service_role;
