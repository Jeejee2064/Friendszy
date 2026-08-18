import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Route dédiée à la réinitialisation de mot de passe, séparée de
// /auth/callback (signup, etc.). Volontairement sans query string dans son
// chemin : le redirectTo passé à resetPasswordForEmail() pointe ici tel
// quel, sans "?next=...". Supabase valide le redirectTo demandé contre la
// liste blanche du dashboard (Authentication > URL Configuration > Redirect
// URLs) par égalité stricte de chaîne — un "?next=..." en plus dans l'URL
// fait échouer ce match même avec une entrée wildcard (constaté en
// production : le redirect_to retombait silencieusement sur le Site URL nu).
// Un chemin fixe sans aucune query string évite le problème : il suffit
// d'une entrée exacte "<origin>/auth/callback/recovery" dans la liste.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/login?recovery=1`);
    }
    // Le code PKCE peut échouer pour plusieurs raisons courantes : lien déjà
    // utilisé, expiré, "pré-cliqué" par un scanner anti-hameçonnage côté
    // courriel (Gmail/Outlook), ou ouvert dans un navigateur différent de
    // celui qui a fait la demande (le code_verifier vit dans un cookie
    // propre à ce navigateur). On journalise pour pouvoir diagnostiquer.
    console.error("[auth/callback/recovery] exchangeCodeForSession failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=reset-expired`);
}
