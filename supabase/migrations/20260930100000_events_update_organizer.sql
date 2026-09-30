-- Permet à l'organisateur (ou à un admin) de modifier son événement.
-- public.events vit en base hors migration suivie (créée dans Studio) : cette
-- migration est idempotente pour ne pas entrer en conflit avec une policy
-- d'update éventuellement déjà présente.

grant update on public.events to authenticated;

drop policy if exists events_update_organizer on public.events;
create policy events_update_organizer on public.events
  for update
  using (is_active_user() and (creator_id = auth.uid() or is_admin()))
  with check (is_active_user() and (creator_id = auth.uid() or is_admin()));
