import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

// Client service_role — SERVEUR UNIQUEMENT (route handlers / server actions).
// Ne jamais importer ce fichier depuis un composant "use client".
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Variables d'environnement manquantes: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY."
    );
  }

  return createClient<Database>(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
