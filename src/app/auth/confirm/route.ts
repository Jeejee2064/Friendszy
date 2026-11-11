import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Confirmation de courriel et réinitialisation de mot de passe par jeton
// (token_hash + verifyOtp), en complément de /auth/callback et
// /auth/callback/recovery (flux PKCE avec `code`, conservés pour les courriels
// déjà envoyés).
//
// Pourquoi : le flux PKCE exige le cookie `code_verifier` du navigateur qui a
// lancé la demande. Dans l'app Capacitor, la demande part de la WebView, mais le
// lien du courriel (domaine supabase.co) s'ouvre dans Chrome : l'échange échoue
// et le jeton est déjà consommé. Ce lien-ci pointe directement sur
// friendszy.ca : il s'ouvre dans l'app (App Links) et verifyOtp n'a besoin
// d'aucun cookie préalable. Modèles de courriel : emails/ (voir emails/README.md).
//
// Route hors du matcher de proxy.ts (préfixe "auth"), donc accessible sans session.
const CONFIRM_TYPES: EmailOtpType[] = ["signup", "recovery", "email"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const isRecovery = type === "recovery";

  if (tokenHash && type && CONFIRM_TYPES.includes(type)) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      if (isRecovery) {
        // Session ouverte : /login?recovery=1 affiche le formulaire de nouveau mot de passe.
        return NextResponse.redirect(`${origin}/login?recovery=1`);
      }
      // Confirmation : même comportement que /auth/callback — on valide l'adresse,
      // on referme la session, la connexion reste un geste explicite.
      const userId = data.user?.id;
      await supabase.auth.signOut();
      const redirectUrl = new URL("/login", origin);
      redirectUrl.searchParams.set("confirmed", "1");
      if (userId) redirectUrl.searchParams.set("uid", userId);
      return NextResponse.redirect(redirectUrl);
    }
    console.error("[auth/confirm] verifyOtp failed:", type, error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=${isRecovery ? "reset-expired" : "auth"}`);
}
