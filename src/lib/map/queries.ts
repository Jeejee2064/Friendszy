import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export type NearbyProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  latitude: number;
  longitude: number;
};

// Only ever returns users with a row in profile_locations that RLS
// (profile_locations_select) already allows the caller to see — opted into
// visible_to_others, not blocked, active account. See
// supabase/migrations/20260922110000_profile_locations.sql.
export async function getNearbyVisibleProfiles(supabase: Client): Promise<NearbyProfile[]> {
  const { data, error } = await supabase.rpc("get_nearby_visible_profiles");
  if (error) throw error;
  return data ?? [];
}

// Whether the current user's own profile_locations row has sharing on —
// used only to seed the map location control's initial UI state.
export async function getMyMapVisibility(supabase: Client, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("profile_locations")
    .select("visible_to_others")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.visible_to_others ?? false;
}

// p_latitude/p_longitude are the raw browser position — fuzzed server-side
// before storage, never persisted as received. Also flips
// visible_to_others on, atomically, in the same call (see the migration).
export async function setMapLocation(
  supabase: Client,
  latitude: number,
  longitude: number
): Promise<void> {
  const { error } = await supabase.rpc("set_map_location", {
    p_latitude: latitude,
    p_longitude: longitude,
  });
  if (error) throw error;
}

// Turns visible_to_others off and clears the stored position, atomically.
export async function clearMapLocation(supabase: Client): Promise<void> {
  const { error } = await supabase.rpc("clear_map_location");
  if (error) throw error;
}
