import { createClient } from "@/lib/supabase/client";

export async function signOutUser() {
  const supabase = createClient();

  return supabase.auth.signOut();
}
