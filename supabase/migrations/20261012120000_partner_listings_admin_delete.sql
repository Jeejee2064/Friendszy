-- Suppression définitive d'une fiche partenaire par un admin (dashboard
-- Admin > Partenaires). Avant ça, authenticated n'avait que SELECT/INSERT/
-- UPDATE sur partner_listings — pas de DELETE.

drop policy if exists partner_listings_delete_admin on public.partner_listings;

create policy partner_listings_delete_admin on public.partner_listings
  for delete
  using (is_admin());

-- GRANT séparé du RLS (voir CLAUDE.md) : sans lui, 42501 avant même
-- l'évaluation de la policy.
grant delete on public.partner_listings to authenticated;
