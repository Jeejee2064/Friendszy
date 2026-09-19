import { createClient } from "@/lib/supabase/client";

export async function signUpWithEmail(
  email: string,
  password: string,
  privacyAcceptedAt: string
) {
  const supabase = createClient();

  return supabase.auth.signUp({
    email,
    password,
    options: {
      // Voir src/app/auth/callback/recovery/route.ts pour le pourquoi de
      // l'absence de query string : Supabase valide le redirectTo demandé
      // contre la liste blanche du dashboard par égalité stricte de chaîne,
      // et un "?next=..." en plus fait échouer ce match même avec une entrée
      // wildcard — il retombe alors silencieusement sur le Site URL nu (d'où
      // le lien de confirmation qui ramenait sur la page d'inscription).
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      // The profiles row doesn't exist with an authenticated session behind
      // it until the confirmation email is clicked, so the moment of
      // consent can't be written to the DB directly here — it rides along
      // in auth user_metadata and gets copied into profiles.privacy_accepted_at
      // on first authenticated load (see (app)/layout.tsx).
      data: { privacy_accepted_at: privacyAcceptedAt },
    },
  });
}
