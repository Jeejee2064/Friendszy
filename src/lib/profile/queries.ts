import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { Interest, ProfileFormData, ProfileSummary } from "./types";

type Client = SupabaseClient<Database>;

export async function getProfilesByIds(
  supabase: Client,
  ids: string[]
): Promise<ProfileSummary[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, city, age, gender")
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

export async function upsertMyProfile(
  supabase: Client,
  userId: string,
  fields: {
    full_name?: string;
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
