import { createClient } from "@/lib/supabase/client";

export async function requestPasswordReset(email: string) {
  const supabase = createClient();

  return supabase.auth.resetPasswordForEmail(email, {
    // Chemin fixe, sans query string — voir le commentaire dans
    // src/app/auth/callback/recovery/route.ts pour le pourquoi.
    redirectTo: `${window.location.origin}/auth/callback/recovery`,
  });
}

export async function updatePassword(newPassword: string) {
  const supabase = createClient();

  return supabase.auth.updateUser({ password: newPassword });
}
