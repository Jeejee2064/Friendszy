-- Feedback bêta : formulaire accessible via un bouton flottant à tous les
-- utilisateurs connectés (voir BetaFeedbackButton côté app), consulté et
-- traité depuis /admin/beta-feedback. Sur le modèle de
-- 20260914140000_cities_catalogue.sql / 20260914160000_conversation_presence.sql
-- pour la table, et introduit en plus le premier bucket de stockage créé
-- explicitement en migration (contrairement à "avatars", public, créé à la
-- main dans Studio et jamais suivi ici) — celui-ci est privé, car une
-- capture d'écran de feedback n'est destinée qu'à son auteur et aux admins,
-- jamais aux autres utilisateurs.
create table public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('bug', 'idea', 'other')),
  message text not null,
  page_url text,
  locale text,
  user_agent text,
  -- Chemin dans le bucket "beta-feedback-screenshots" (pas une URL — le
  -- bucket est privé, l'URL affichée est générée à la demande via
  -- createSignedUrl côté client). Nul si aucune capture jointe.
  screenshot_path text,
  status text not null default 'new' check (status in ('new', 'read', 'resolved')),
  created_at timestamptz not null default now()
);

create index beta_feedback_status_created_at_idx on public.beta_feedback (status, created_at desc);
create index beta_feedback_user_id_idx on public.beta_feedback (user_id);

alter table public.beta_feedback enable row level security;

-- Un utilisateur voit son propre feedback (utile pour un futur "mes
-- retours"), un admin voit tout.
create policy beta_feedback_select on public.beta_feedback
  for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy beta_feedback_insert_own on public.beta_feedback
  for insert
  to authenticated
  with check (user_id = auth.uid() and is_active_user());

-- Seul un admin peut changer le statut — pas d'édition du contenu par
-- l'auteur, même esprit que les messages figés (enforce_message_immutability).
create policy beta_feedback_update_admin on public.beta_feedback
  for update
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy beta_feedback_delete_admin on public.beta_feedback
  for delete
  to authenticated
  using (is_admin());

-- GRANT explicite obligatoire en plus du RLS (voir CLAUDE.md) — sans lui,
-- RLS n'est même pas évalué et tout accès échoue en 42501.
grant select, insert, update, delete on public.beta_feedback to authenticated;

-- Bucket privé pour les captures d'écran jointes au feedback.
insert into storage.buckets (id, name, public)
values ('beta-feedback-screenshots', 'beta-feedback-screenshots', false)
on conflict (id) do nothing;

-- Dossier par utilisateur (beta-feedback-screenshots/{user_id}/...), même
-- convention que le bucket "avatars" — le premier segment du chemin sert de
-- scope de propriété.
create policy beta_feedback_screenshots_insert_own on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'beta-feedback-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy beta_feedback_screenshots_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'beta-feedback-screenshots'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_admin())
  );

create policy beta_feedback_screenshots_delete_admin on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'beta-feedback-screenshots'
    and is_admin()
  );
