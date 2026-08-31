import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/login";
  const isRecovery = next.includes("recovery=1");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Marqueur consommé une fois par onboarding-wizard.tsx pour logger
      // signup_completed — jamais pour un lien de réinitialisation, et
      // seulement à la toute première confirmation réussie.
      const redirectTo = isRecovery
        ? `${origin}${next}`
        : `${origin}${next}${next.includes("?") ? "&" : "?"}confirmed=1`;
      return NextResponse.redirect(redirectTo);
    }
    // Le code PKCE peut échouer pour plusieurs raisons courantes : lien déjà
    // utilisé, expiré, "pré-cliqué" par un scanner anti-hameçonnage côté
    // courriel (Gmail/Outlook), ou ouvert dans un navigateur différent de
    // celui qui a fait la demande (le code_verifier vit dans un cookie
    // propre à ce navigateur). On journalise pour pouvoir diagnostiquer.
    console.error("[auth/callback] exchangeCodeForSession failed:", error.message);
  }

  // Pour un lien de réinitialisation qui échoue, on renvoie vers l'écran
  // "mot de passe oublié" avec un message clair plutôt que l'écran de
  // connexion normal sans explication.
  const errorCode = isRecovery ? "reset-expired" : "auth";
  return NextResponse.redirect(`${origin}/login?error=${errorCode}`);
}
