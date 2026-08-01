import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export type PartnerListingRow = Database["public"]["Tables"]["partner_listings"]["Row"];
export type PartnerListingStatus = "active" | "inactive";

export async function createPartnerListing(
  supabase: Client,
  fields: {
    id?: string;
    name: string;
    description: string | null;
    interest_id: number;
    city: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    website: string | null;
    photo_urls: string[];
  },
  profileId: string
): Promise<PartnerListingRow> {
  // `status` is never sent — it's protected by a trigger and always starts
  // at its DB default ('inactive'); only an admin can activate it.
  const { data, error } = await supabase
    .from("partner_listings")
    .insert({ ...fields, profile_id: profileId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updatePartnerListing(
  supabase: Client,
  id: string,
  fields: Partial<{
    name: string;
    description: string | null;
    interest_id: number;
    city: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    website: string | null;
    photo_urls: string[];
  }>
) {
  const { error } = await supabase
    .from("partner_listings")
    .update(fields)
    .eq("id", id);
  if (error) throw error;
}

export async function getPartnerListingById(
  supabase: Client,
  id: string
): Promise<PartnerListingRow | null> {
  const { data, error } = await supabase
    .from("partner_listings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getPartnerListingsByIds(
  supabase: Client,
  ids: string[]
): Promise<PartnerListingRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("partner_listings").select("*").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function listPartnerListings(
  supabase: Client,
  filters: { interestId?: number; city?: string }
): Promise<PartnerListingRow[]> {
  let query = supabase
    .from("partner_listings")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.interestId != null) query = query.eq("interest_id", filters.interestId);

  if (filters.city?.trim()) {
    const { data: cityMatches, error: cityError } = await supabase.rpc(
      "match_partner_listing_city_ids",
      { p_city: filters.city.trim() }
    );
    if (cityError) throw cityError;
    const ids = (cityMatches ?? []).map((row) => row.id);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listAllPartnerListingsForAdmin(
  supabase: Client
): Promise<PartnerListingRow[]> {
  const { data, error } = await supabase
    .from("partner_listings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Only succeeds when called by an admin (RLS `partner_listings_update` +
 * the `enforce_partner_listing_sensitive_columns` trigger both gate
 * `status` changes to admin/service_role) — the same seam a future Stripe
 * webhook plugs into via the service-role client.
 */
export async function setPartnerListingActive(
  supabase: Client,
  listingId: string,
  active: boolean
) {
  const { error } = await supabase
    .from("partner_listings")
    .update({ status: active ? "active" : "inactive" })
    .eq("id", listingId);
  if (error) throw error;
}

export async function uploadPartnerListingPhoto(
  supabase: Client,
  listingId: string,
  blob: Blob
): Promise<string> {
  const path = `${listingId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("partner-photos").upload(path, blob, {
    contentType: "image/jpeg",
  });
  if (error) throw error;

  const { data } = supabase.storage.from("partner-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function removePartnerListingPhoto(supabase: Client, url: string) {
  const marker = "/partner-photos/";
  const index = url.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(url.slice(index + marker.length));
  const { error } = await supabase.storage.from("partner-photos").remove([path]);
  if (error) throw error;
}
