import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export type BlockedProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
};

export async function blockUser(
  supabase: Client,
  blockerId: string,
  blockedId: string
) {
  const { error } = await supabase
    .from("blocks")
    .insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

export async function isBlockedBetween(
  supabase: Client,
  a: string,
  b: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_blocked_between", { a, b });
  if (error) throw error;
  return !!data;
}

export async function haveIBlocked(
  supabase: Client,
  blockerId: string,
  blockedId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("blocks")
    .select("blocker_id")
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function unblockUser(
  supabase: Client,
  blockerId: string,
  blockedId: string
) {
  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", blockerId)
    .eq("blocked_id", blockedId);
  if (error) throw error;
}

export async function listBlockedProfiles(supabase: Client): Promise<BlockedProfile[]> {
  const { data, error } = await supabase.rpc("get_blocked_profiles");
  if (error) throw error;
  return data ?? [];
}
