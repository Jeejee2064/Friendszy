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
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      // The profiles row doesn't exist with an authenticated session behind
      // it until the confirmation email is clicked, so the moment of
      // consent can't be written to the DB directly here — it rides along
      // in auth user_metadata and gets copied into profiles.privacy_accepted_at
      // on first authenticated load (see (app)/layout.tsx).
      data: { privacy_accepted_at: privacyAcceptedAt },
    },
  });
}
