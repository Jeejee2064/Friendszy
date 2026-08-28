-- Toutes les autres catégories 'sports' utilisent l'emoji médaille comme icône
-- (voir interests-grid.tsx, items[0]?.emoji) ; 'bolidage' (Tuning) était la seule
-- ligne sans emoji. Déjà appliqué en production (2026-08-24), migration ajoutée
-- ici pour la traçabilité.
update public.interests set emoji = '🏅' where slug = 'bolidage';
