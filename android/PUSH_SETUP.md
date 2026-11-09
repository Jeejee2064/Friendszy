# Push natif Android (FCM) — mise en place

Code en place : plugin `@capacitor/push-notifications`, `src/lib/push/native.ts`,
table `native_push_tokens`, envoi FCM dans `supabase/functions/push-new-message`.
Il reste les étapes manuelles ci-dessous (compte Firebase requis).

1. **Firebase** : créer un projet, ajouter une app Android avec l'ID `ca.friendszy.app`
   (à confirmer avec le client — il doit correspondre à `capacitor.config.ts`).
2. Télécharger `google-services.json` → `android/app/google-services.json`
   (le plugin Gradle ne s'applique que si ce fichier existe), puis `npm run cap:sync`.
3. Firebase → Paramètres → Comptes de service → générer une clé privée (JSON), puis :
   `supabase secrets set FCM_SERVICE_ACCOUNT="$(cat cle.json)"` — ne jamais committer ce JSON.
4. Appliquer la migration `20261109120000_native_push_tokens.sql`, puis régénérer
   `src/types/supabase.ts` via la CLI et retirer les 2 casts marqués `TODO`
   (`src/lib/push/native.ts`, `src/lib/account/actions.ts`).
5. Redéployer : `supabase functions deploy push-new-message`.
6. Test : installer l'APK, activer les notifications, mettre l'app en arrière-plan,
   envoyer un message depuis un autre compte.
