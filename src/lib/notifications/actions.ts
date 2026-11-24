"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TEST_COOLDOWN_MS = 30_000;

// Notification de test : insère une ligne `push_test` pour soi-même, ce qui
// emprunte exactement le même chemin qu'une vraie notification (trigger →
// Edge Function → appareils). Insertion par service_role car les utilisateurs
// ne peuvent pas écrire dans `notifications`. Cette ligne n'apparaît ni dans
// la liste ni dans le compteur de la cloche.
export async function sendTestNotification(): Promise<{ error?: "unauthenticated" | "rate_limited" | "failed" }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "unauthenticated" };

  const admin = createAdminClient();
  const since = new Date(Date.now() - TEST_COOLDOWN_MS).toISOString();
  const { data: recent } = await admin
    .from("notifications")
    .select("id")
    .eq("user_id", user.id)
    .eq("type", "push_test")
    .gt("created_at", since)
    .limit(1);
  if (recent && recent.length > 0) return { error: "rate_limited" };

  const { error } = await admin
    .from("notifications")
    .insert({ user_id: user.id, type: "push_test", payload: {} });
  return error ? { error: "failed" } : {};
}
