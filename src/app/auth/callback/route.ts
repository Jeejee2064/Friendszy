import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Route dédiée à la confirmation de signup — la réinitialisation de mot de
// passe a sa propre route (auth/callback/recovery/route.ts). Volontairement
// sans query string dans son chemin ni dans l'emailRedirectTo qui y mène
// (voir src/lib/auth/sign-up.ts) : Supabase valide le redirectTo demandé
// contre la liste blanche du dashboard par égalité stricte de chaîne, et un
// "?next=..." en plus faisait échouer ce match même avec une entrée
// wildcard — il retombait alors silencieusement sur le Site URL nu (le lien
// de confirmation ramenait sur la page d'inscription plutôt que la page de
// connexion). Les paramètres ajoutés plus bas au "/login" de destination
// n'ont pas ce problème : ils sont posés par notre propre redirect, pas par
// celui de Supabase.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // exchangeCodeForSession confirme le courriel ET ouvre une session —
      // mais celle-ci vit dans le navigateur qui a exécuté cette requête,
      // qui n'est pas forcément celui de l'utilisateur (scanner anti-hameçonnage
      // côté client courriel, lien ouvert sur un autre appareil...). On la
      // referme aussitôt et on renvoie vers /login : la confirmation ne
      // fait que valider l'adresse, la connexion reste un geste explicite.
      const userId = data.user?.id;
      await supabase.auth.signOut();
      const redirectUrl = new URL("/login", origin);
      redirectUrl.searchParams.set("confirmed", "1");
      if (userId) redirectUrl.searchParams.set("uid", userId);
      return NextResponse.redirect(redirectUrl);
    }
    // Le code PKCE peut échouer pour plusieurs raisons courantes : lien déjà
    // utilisé, expiré, "pré-cliqué" par un scanner anti-hameçonnage côté
    // courriel (Gmail/Outlook), ou ouvert dans un navigateur différent de
    // celui qui a fait la demande (le code_verifier vit dans un cookie
    // propre à ce navigateur). On journalise pour pouvoir diagnostiquer.
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
