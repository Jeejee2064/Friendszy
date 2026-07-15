# Friendszy — Contexte projet

## Le projet

Friendszy est une PWA (progressive web app) qui aide les gens à se faire de nouveaux amis
par centres d'intérêt communs (sport, musique, lecture, jeux de société...). Positionnement
**strictement amical** — ce n'est PAS une app de rencontres amoureuses. Le vocabulaire, les
visuels et le ton doivent toujours rester cohérents avec ça.

- Client : Alexandre Chaput, Friendszy Inc. (Québec, Canada)
- Lancement visé : 1er octobre 2026
- Bilingue français / anglais, **français par défaut**
- Conformité Loi 25 (protection des données, Québec) : hébergement des données au Canada,
  suppression réelle de compte, export des données — voir section Base de données.
- PWA d'abord (pas d'app native pour l'instant — installable sur mobile sans passer par les stores)

## Stack technique

- **Frontend** : Next.js (App Router), PWA (manifest + service worker, installable)
- **Backend / DB** : Supabase (PostgreSQL), projet hébergé en **région Canada (Central)**
- **i18n** : next-intl, `fr` par défaut, `en` en second
- **Auth** : Supabase Auth — email/mot de passe (Google OAuth ajouté plus tard, pas encore
  configuré côté Google Cloud), confirmation par courriel, réinitialisation de mot de passe
- **Temps réel** : Supabase Realtime (messagerie, présence)
- **Stockage fichiers** : Supabase Storage (bucket `avatars`, un dossier par utilisateur : `avatars/{user_id}/...`)

## Base de données — déjà en place

Le schéma complet (Phase 1, hors groupes) est déjà créé et migré dans Supabase, RLS activé
partout. **Ne pas modifier le schéma sans concertation** — il a été pensé pour accueillir
les évolutions futures sans casser l'existant.

Tables : `profiles`, `interests`, `profile_interests`, `friendships`, `blocks`, `conversations`,
`messages`, `reports`, `notifications`.

Points importants à connaître avant de coder dessus :

- **RLS strict partout.** Chaque table a ses policies (select/insert/update séparées). Toujours
  utiliser le client Supabase authentifié côté utilisateur (jamais la `service_role` key côté
  client). Des fonctions utilitaires existent déjà : `is_blocked_between()`, `is_conversation_participant()`,
  `is_admin()`, `is_active_user()`.
- **Messages figés.** Un message envoyé ne peut plus être modifié (trigger `enforce_message_immutability`).
  Seul le statut `read_at` peut passer de `null` à une date. Un admin peut poser `removed_at`/`removed_by`
  (retrait doux) mais jamais changer le contenu.
- **Colonnes sensibles du profil protégées.** `plan`, `plan_valid_until`, `moderation_status`,
  `is_admin` ne sont modifiables ni par l'utilisateur lui-même (bloqué par trigger), seulement par
  un admin ou le serveur (`service_role`).
- **`profiles.plan`** (`free` / `premium`) : le système d'abonnement (freemium) n'est PAS encore
  branché (Stripe viendra en Phase 2), mais la colonne existe déjà et doit être respectée dans
  toute logique de limites qu'on écrira plus tard (ne pas coder de limites en dur, prévoir qu'elles
  liront ce champ).
- **Comptes suspendus/bannis** (`moderation_status`) ne peuvent plus écrire (policies déjà en place
  côté DB) — mais penser à aussi gérer l'expérience côté UI (message clair plutôt qu'une erreur brute).

## Ce qui n'existe PAS encore dans la DB (à ne pas construire pour l'instant)

- **Groupes** (privés et publics) : arriveront en Phase 2 dans une prochaine migration. Ne pas
  créer de tables ou de code qui présuppose leur existence.
- **Stripe / paiement** : pas branché. Le champ `plan` reste `free` pour tout le monde au lancement.
- **Notifications push mobile** : Phase 2. Seules les notifications in-app sont dans le scope actuel.
- **Suppression de compte / export de données (Loi 25)** : le mécanisme reste à construire
  (nécessitera une fonction serveur avec `service_role`, à faire au lot Paramètres).

## Design system

**Polices** (Google Fonts) :
- `Nunito` (poids 400, 600, 700, 800, 900) — police principale, tout le texte courant
- `Pacifico` (cursive) — décorative uniquement : logo "Friendszy", accents ponctuels (numéros d'étapes, stats du hero)
- Import : `family=Pacifico&family=Nunito:wght@400;600;700;800;900`

**Couleurs** (variables CSS `:root`) :

```css
:root {
  --teal1: #1ecfb0;   /* teal principal — dégradé, icônes, accents */
  --teal2: #1ab8c0;   /* teal secondaire — liens, hover, focus */
  --blue: #1a90c8;    /* bleu — dégradé, accents secondaires */
  --dark: #0d5f8a;    /* bleu foncé — peu utilisé */
  --white: #fff;
  --bg: #e8f8f5;      /* fond général clair (sections, hero) */
  --text: #1a2e2b;    /* texte principal */
  --muted: #6b9e96;   /* texte secondaire / descriptions */
  --border: #d0f0ee;  /* bordures claires */
  --card: #fff;       /* fond des cartes */
  --grad: linear-gradient(135deg, #1ecfb0, #1ab8c0, #1a90c8); /* CTA, titres en surbrillance, icônes de section, footer CTA */
}
```

Footer : fond `#0d2420`, texte `#6b9e96` / `#4a7870`.
Accents ponctuels : `#f59e0b` (étoiles témoignages), `#e55` (lien "Signaler un abus").

Identité générale : dégradé teal → bleu (chaleureux, moderne, confiance/convivialité), fond
clair menthe/blanc, Nunito pour la lisibilité, Pacifico pour la touche amicale du branding.
Une landing page de référence existe déjà (visuel à reprendre comme base de cohérence) : voir
la maquette fournie par le client.

## Leçons apprises en cours de route (à respecter pour toute nouvelle table)

- **GRANT obligatoire en plus du RLS.** Une table créée par SQL brut (migration) n'a PAS
  automatiquement les privilèges de base pour le rôle `authenticated` — contrairement à une
  table créée via l'éditeur Supabase Studio, qui les pose toute seule. Sans
  `grant select, insert, update, delete on <table> to authenticated;` (adapté aux opérations
  réellement autorisées), RLS ou pas, tout accès échoue en `42501`, RLS n'est même pas évalué.
  **Chaque nouvelle table (groupes compris, Phase 2) doit inclure ses GRANT explicites dans
  la même migration que ses policies RLS.**
- **Types TypeScript : toujours régénérés via la CLI Supabase**
  (`supabase gen types typescript --project-id ... > database.types.ts`), jamais maintenus
  à la main. Un fichier de types écrit/modifié manuellement a déjà cassé l'inférence de type
  de postgrest-js (colonne `Relationships` manquante). Après toute migration (ex. ajout des
  tables de groupes), régénérer ce fichier plutôt que de le corriger à la main.

## Conventions générales

- Toujours écrire les textes visibles en **français d'abord**, avec la clé de traduction anglaise
  à côté (next-intl) — ne jamais coder de texte en dur non traduit.
- Toute nouvelle table doit naître avec RLS activé (le projet Supabase est configuré pour ça par
  défaut) — ne jamais désactiver le RLS pour "tester plus vite".
- Ne jamais exposer la `service_role` key côté client. Elle ne vit que dans des fonctions serveur.
- Le code source reste sur le repo du développeur pendant le développement ; transfert au client
  prévu à la livraison finale.