# Modèles de courriel Supabase Auth

Ces fichiers se collent dans Supabase → Authentication → Email Templates
(`confirm-signup.html` = « Confirm signup », `reset-password.html` = « Reset Password »).

Les liens utilisent `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=…`
(route `src/app/auth/confirm/route.ts`) au lieu de `{{ .ConfirmationURL }}`, pour que
le lien s'ouvre dans l'app Android/iOS (App Links) et fonctionne même ouvert dans un
autre navigateur que celui de la demande.

**Ordre de mise en ligne : déployer le site (route `/auth/confirm`) AVANT de coller
les modèles dans Supabase**, sinon les liens envoyés pointeraient vers une route
inexistante. Les anciens courriels déjà envoyés continuent de marcher
(`/auth/callback`, `/auth/callback/recovery` sont conservées).

Vérifier que « Site URL » (Authentication → URL Configuration) vaut https://friendszy.ca.
