import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { Interest, ProfileFormData, ProfilePhoto, ProfileSummary } from "./types";

type Client = SupabaseClient<Database>;

export async function getProfilesByIds(
  supabase: Client,
  ids: string[]
): Promise<ProfileSummary[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, last_name, avatar_url, city, age, gender, temporary_city_until")
    .in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export async function getInterests(supabase: Client): Promise<Interest[]> {
  const { data, error } = await supabase
    .from("interests")
    .select("*")
    .order("category")
    .order("label_fr");
  if (error) throw error;
  return data ?? [];
}

export async function getMyProfile(supabase: Client, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyInterestIds(
  supabase: Client,
  userId: string
): Promise<number[]> {
  const { data, error } = await supabase
    .from("profile_interests")
    .select("interest_id")
    .eq("profile_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.interest_id);
}

export async function uploadAvatar(
  supabase: Client,
  userId: string,
  blob: Blob
): Promise<string> {
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, {
    upsert: true,
    contentType: "image/jpeg",
  });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function getProfilePhotos(
  supabase: Client,
  profileId: string
): Promise<ProfilePhoto[]> {
  const { data, error } = await supabase
    .from("profile_photos")
    .select("*")
    .eq("profile_id", profileId)
    .order("position");
  if (error) throw error;
  return data ?? [];
}

// Photos supplémentaires du profil (jusqu'à 3, plafond appliqué aussi côté DB
// par enforce_profile_photos_limit). Réutilise le bucket "avatars" — dossier
// avatars/{userId}/..., déjà couvert par les policies storage.objects
// scoped au premier segment du chemin = auth.uid() — voir
// supabase/migrations/20260909120000_profile_photos.sql. Contrairement à
// uploadAvatar (nom de fichier fixe), chaque photo a un nom unique.
export async function uploadProfilePhoto(
  supabase: Client,
  userId: string,
  blob: Blob
): Promise<string> {
  const path = `${userId}/extra-${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, {
    contentType: "image/jpeg",
  });
  if (error) throw error;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = data.publicUrl;

  const { count } = await supabase
    .from("profile_photos")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId);

  const { error: insertError } = await supabase
    .from("profile_photos")
    .insert({ profile_id: userId, url, position: count ?? 0 });
  if (insertError) throw insertError;

  return url;
}

export async function removeProfilePhoto(supabase: Client, userId: string, url: string) {
  const { error: deleteRowError } = await supabase
    .from("profile_photos")
    .delete()
    .eq("profile_id", userId)
    .eq("url", url);
  if (deleteRowError) throw deleteRowError;

  const marker = "/avatars/";
  const index = url.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(url.slice(index + marker.length));
  const { error } = await supabase.storage.from("avatars").remove([path]);
  if (error) throw error;
}

export async function upsertMyProfile(
  supabase: Client,
  userId: string,
  fields: {
    full_name?: string;
    last_name?: string;
    avatar_url?: string | null;
    city?: string | null;
    age?: number | null;
    gender?: ProfileFormData["gender"];
    bio?: string | null;
  }
) {
  const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
  if (error) throw error;
}

// Ville temporaire (Premium) — la validation (plan, durée, compte actif)
// vit entièrement côté serveur dans ces deux fonctions RPC ; voir
// supabase/migrations/20260908180000_profiles_temporary_city.sql. Le client
// ne peut pas écrire profiles.temporary_city_until/home_city directement
// (privilège colonne retiré), donc ces wrappers sont le seul chemin.
export async function setTemporaryCity(
  supabase: Client,
  city: string,
  until: Date
) {
  const { error } = await supabase.rpc("set_temporary_city", {
    p_city: city,
    p_until: until.toISOString(),
  });
  if (error) throw error;
}

export async function clearTemporaryCity(supabase: Client) {
  const { error } = await supabase.rpc("clear_temporary_city");
  if (error) throw error;
}

export async function setMyInterests(
  supabase: Client,
  userId: string,
  interestIds: number[]
) {
  const { error: deleteError } = await supabase
    .from("profile_interests")
    .delete()
    .eq("profile_id", userId);
  if (deleteError) throw deleteError;

  if (interestIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("profile_interests")
    .insert(interestIds.map((interest_id) => ({ profile_id: userId, interest_id })));
  if (insertError) throw insertError;
}
