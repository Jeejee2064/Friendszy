-- Durcissement issu de l'audit de sécurité (2026-10-21).
--
-- 1. anon/authenticated avaient TRUNCATE, REFERENCES, TRIGGER sur toutes les
--    tables publiques (hors RLS). Inutile et dangereux : retirés.
-- 2. Toutes les fonctions SECURITY DEFINER étaient exécutables par anon
--    (EXECUTE accordé à PUBLIC par défaut). Seule get_public_map_points()
--    est volontairement publique (landing page).
-- 3. Storage : les policies d'upload de event-photos s'appliquaient au rôle
--    public (donc anon) et laissaient n'importe qui écrire dans n'importe
--    quel dossier d'événement inexistant. Les policies partner-photos et
--    group-avatars référençaient pl.name / g.name (le nom du partenaire ou du
--    groupe) au lieu du chemin de l'objet, ce qui faisait échouer le cast uuid.
-- 4. Taille et type MIME limités sur tous les buckets.

-- 1 ---------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

-- 2 ---------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
      and p.proname not in ('get_public_map_points', 'unaccent', 'immutable_unaccent',
                            'unaccent_init', 'unaccent_lexize')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

-- 3 ---------------------------------------------------------------------
drop policy if exists event_photos_bucket_insert on storage.objects;
create policy event_photos_bucket_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-photos'
    and is_active_user()
    and (
      exists (select 1 from public.events e
              where e.id::text = (storage.foldername(objects.name))[1]
                and e.creator_id = auth.uid())
      or not exists (select 1 from public.events e
                     where e.id::text = (storage.foldername(objects.name))[1])
      or is_admin()
    )
  );

drop policy if exists event_photos_bucket_delete on storage.objects;
create policy event_photos_bucket_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-photos'
    and (
      exists (select 1 from public.events e
              where e.id::text = (storage.foldername(objects.name))[1]
                and e.creator_id = auth.uid())
      or is_admin()
    )
  );

drop policy if exists partner_photos_insert on storage.objects;
create policy partner_photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'partner-photos'
    and is_active_user()
    and (
      is_admin()
      or exists (select 1 from public.partner_listings pl
                 where pl.id::text = (storage.foldername(objects.name))[1]
                   and pl.profile_id = auth.uid())
      or not exists (select 1 from public.partner_listings pl
                     where pl.id::text = (storage.foldername(objects.name))[1])
    )
  );

drop policy if exists partner_photos_delete on storage.objects;
create policy partner_photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'partner-photos'
    and (
      is_admin()
      or exists (select 1 from public.partner_listings pl
                 where pl.id::text = (storage.foldername(objects.name))[1]
                   and pl.profile_id = auth.uid())
    )
  );

drop policy if exists group_avatars_insert on storage.objects;
create policy group_avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'group-avatars'
    and is_active_user()
    and (
      exists (select 1 from public.groups g
              where g.id::text = (storage.foldername(objects.name))[1]
                and is_group_admin(g.id))
      or not exists (select 1 from public.groups g
                     where g.id::text = (storage.foldername(objects.name))[1])
    )
  );

drop policy if exists group_avatars_update on storage.objects;
create policy group_avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'group-avatars'
    and exists (select 1 from public.groups g
                where g.id::text = (storage.foldername(objects.name))[1]
                  and is_group_admin(g.id))
  );

-- 4 ---------------------------------------------------------------------
update storage.buckets
set file_size_limit = 5 * 1024 * 1024,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id in ('avatars', 'group-avatars', 'partner-photos', 'event-photos', 'beta-feedback-screenshots');
