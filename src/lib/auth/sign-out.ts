import { createClient } from "@/lib/supabase/client";
import { removeNativePushToken } from "@/lib/push/native";

export async function signOutUser() {
  const supabase = createClient();

  // Push natif : retirer le jeton de cet appareil tant que la session est valide.
  await removeNativePushToken(supabase);

  return supabase.auth.signOut();
}
