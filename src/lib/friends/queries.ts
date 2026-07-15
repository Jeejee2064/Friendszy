import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getProfilesByIds } from "@/lib/profile/queries";
import type { ProfileSummary } from "@/lib/profile/types";

type Client = SupabaseClient<Database>;

export type FriendshipStatus = "pending_sent" | "pending_received" | "accepted";

export type FriendshipInfo = {
  friendshipId: string;
  status: FriendshipStatus;
};

export async function getFriendshipMap(
  supabase: Client,
  myId: string
): Promise<Map<string, FriendshipInfo>> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, addressee_id, status")
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
    .neq("status", "declined");
  if (error) throw error;

  const map = new Map<string, FriendshipInfo>();
  for (const row of data ?? []) {
    const otherId = row.requester_id === myId ? row.addressee_id : row.requester_id;
    const status: FriendshipStatus =
      row.status === "accepted"
        ? "accepted"
        : row.requester_id === myId
          ? "pending_sent"
          : "pending_received";
    map.set(otherId, { friendshipId: row.id, status });
  }
  return map;
}

export async function listFriends(
  supabase: Client,
  myId: string
): Promise<ProfileSummary[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);
  if (error) throw error;

  const otherIds = (data ?? []).map((row) =>
    row.requester_id === myId ? row.addressee_id : row.requester_id
  );
  return getProfilesByIds(supabase, otherIds);
}

export type PendingRequest = {
  friendshipId: string;
  profile: ProfileSummary;
};

export async function listPendingRequests(
  supabase: Client,
  myId: string
): Promise<PendingRequest[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id")
    .eq("status", "pending")
    .eq("addressee_id", myId);
  if (error) throw error;

  const rows = data ?? [];
  const profiles = await getProfilesByIds(
    supabase,
    rows.map((row) => row.requester_id)
  );
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return rows
    .map((row) => {
      const profile = profileById.get(row.requester_id);
      return profile ? { friendshipId: row.id, profile } : null;
    })
    .filter((r): r is PendingRequest => r !== null);
}

export async function sendFriendRequest(
  supabase: Client,
  requesterId: string,
  addresseeId: string
) {
  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: requesterId, addressee_id: addresseeId });
  if (error) throw error;
}

export async function respondToFriendRequest(
  supabase: Client,
  friendshipId: string,
  accept: boolean
) {
  const { error } = await supabase
    .from("friendships")
    .update({
      status: accept ? "accepted" : "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("id", friendshipId);
  if (error) throw error;
}

export async function removeFriend(supabase: Client, friendshipId: string) {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}
