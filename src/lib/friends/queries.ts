import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getProfilesByIds } from "@/lib/profile/queries";
import { isBlockedBetween } from "@/lib/blocks/queries";
import type { ProfileSummary } from "@/lib/profile/types";

type Client = SupabaseClient<Database>;

// One-directional: a friendship row only means "requester_id added addressee_id
// to their list" — no acceptance step, not mutual. Being in the map means *I*
// added them; it says nothing about whether they've added me back.
export type FriendshipInfo = {
  friendshipId: string;
};

export async function getFriendshipMap(
  supabase: Client,
  myId: string
): Promise<Map<string, FriendshipInfo>> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, addressee_id")
    .eq("requester_id", myId);
  if (error) throw error;

  const map = new Map<string, FriendshipInfo>();
  for (const row of data ?? []) {
    map.set(row.addressee_id, { friendshipId: row.id });
  }
  return map;
}

export async function listFriends(
  supabase: Client,
  myId: string
): Promise<ProfileSummary[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("addressee_id")
    .eq("requester_id", myId);
  if (error) throw error;

  const otherIds = (data ?? []).map((row) => row.addressee_id);
  if (otherIds.length === 0) return [];

  // A friendship row isn't deleted when either side blocks the other.
  // `is_blocked_between` sees both directions (unlike a plain `blocks`
  // select, which RLS limits to blocks I made myself), so it also catches
  // the case where the other person blocked me.
  const blocked = await Promise.all(
    otherIds.map((id) => isBlockedBetween(supabase, myId, id))
  );
  const visibleIds = otherIds.filter((_, i) => !blocked[i]);
  return getProfilesByIds(supabase, visibleIds);
}

export async function addFriend(
  supabase: Client,
  requesterId: string,
  addresseeId: string
) {
  const { data: existing, error: fetchError } = await supabase
    .from("friendships")
    .select("id")
    .eq("requester_id", requesterId)
    .eq("addressee_id", addresseeId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (existing) return;

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId, status: "accepted" });
  if (error) throw error;
}

export async function removeFriend(supabase: Client, friendshipId: string) {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}
