import { createClient } from "@/lib/supabase/client";

export async function requestPasswordReset(email: string) {
  const supabase = createClient();

  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?next=/login`,
  });
}

export async function updatePassword(newPassword: string) {
  const supabase = createClient();

  return supabase.auth.updateUser({ password: newPassword });
}
