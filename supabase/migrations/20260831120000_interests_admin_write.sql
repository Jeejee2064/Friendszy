-- Let admins manage the interests catalogue directly from the admin
-- dashboard (create/edit/delete), on top of the existing approve-suggestion
-- flow (handle_interest_suggestion_resolution) which already writes here as
-- SECURITY DEFINER. interests stays read-only for everyone else.

create policy interests_insert_admin on public.interests
  for insert
  with check (is_admin());

create policy interests_update_admin on public.interests
  for update
  using (is_admin())
  with check (is_admin());

create policy interests_delete_admin on public.interests
  for delete
  using (is_admin());

-- GRANT is separate from RLS (see CLAUDE.md) — without it, RLS is never even
-- evaluated and every write fails with 42501 regardless of the policies above.
grant insert, update, delete on public.interests to authenticated;
