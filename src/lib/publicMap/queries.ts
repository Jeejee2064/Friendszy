import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { PublicMapPoint } from "./types";

type Client = SupabaseClient<Database>;

// Callable unauthenticated (grant execute to anon, see the migration) —
// this is the only data an anonymous visitor's browser ever sees, via the
// public landing page (src/components/landing/public-landing.tsx). The
// regular publishable-key client works fine here whether or not there's a
// session: it's the RPC's own GRANT/SECURITY DEFINER that decides access,
// not the caller's auth state.
export async function getPublicMapPoints(supabase: Client): Promise<PublicMapPoint[]> {
  const { data, error } = await supabase.rpc("get_public_map_points");
  if (error) throw error;

  return (data ?? [])
    .filter(
      (row): row is typeof row & { latitude: number; longitude: number } =>
        row.latitude != null && row.longitude != null
    )
    .map((row) => ({
      kind: row.kind as PublicMapPoint["kind"],
      id: row.id,
      title: row.title,
      city: row.city,
      latitude: row.latitude,
      longitude: row.longitude,
      photoUrl: row.photo_url,
      categoryEmoji: row.category_emoji,
      categoryLabelFr: row.category_label_fr,
      categoryLabelEn: row.category_label_en,
    }));
}
