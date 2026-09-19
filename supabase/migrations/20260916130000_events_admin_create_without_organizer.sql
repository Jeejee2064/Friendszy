-- Lets an admin pre-seed events before launch without becoming the event's
-- organizer (creator_id already nullable on public.events, but events_insert
-- required creator_id = auth.uid() for everyone). Regular users are
-- unaffected: they can still only insert events with themselves as creator.
--
-- NOTE: public.events, public.event_photos, public.event_registrations and
-- public.event_messages (and their existing RLS policies/grants) were never
-- captured in a tracked migration — they were created directly in Supabase
-- Studio. This migration only adds the delta on top of that untracked base;
-- see CLAUDE.md for the same issue already flagged for
-- handle_interest_suggestion_resolution().

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert
  with check (
    is_active_user()
    and (creator_id = auth.uid() or (creator_id is null and is_admin()))
  );

-- is_event_organizer(event_id) checks creator_id = auth.uid(), which is
-- never true for an organizer-less event — without this fallback, nobody
-- could ever attach photos to one.
drop policy if exists event_photos_insert on public.event_photos;
create policy event_photos_insert on public.event_photos
  for insert
  with check (
    (exists (
      select 1 from public.events e
      where e.id = event_photos.event_id and e.creator_id = auth.uid()
    ))
    or is_admin()
  );
