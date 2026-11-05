-- Audit de sécurité (2026-11-05) : partner_listings.website n'avait aucune
-- contrainte de schéma (seul events.website_url en avait une) et est rendu
-- tel quel dans un href. On n'autorise que http(s).
--
-- Les lignes existantes invalides sont neutralisées (NULL) avant d'ajouter la
-- contrainte. NOT VALID n'est pas utilisé : après nettoyage, tout est conforme.

update public.partner_listings
set website = null
where website is not null and website !~* '^https?://';

alter table public.partner_listings
  drop constraint if exists partner_listings_website_scheme_check;
alter table public.partner_listings
  add constraint partner_listings_website_scheme_check
  check (website is null or website ~* '^https?://');
