import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getProfilesByIds } from "@/lib/profile/queries";
import { isBlockedBetween } from "@/lib/blocks/queries";
import type { ProfileSummary } from "@/lib/profile/types";

type Client = SupabaseClient<Database>;

export type FriendshipStatus =
  | "pending_sent"
  | "pending_received"
  | "accepted"
  | "declined_by_them";

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
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);
  if (error) throw error;

  const map = new Map<string, FriendshipInfo>();
  for (const row of data ?? []) {
    const otherId = row.requester_id === myId ? row.addressee_id : row.requester_id;
    if (row.status === "declined") {
      // Only the person who got declined is blocked from re-sending; the one
      // who declined is free to send a fresh request later if they change their mind.
      if (row.requester_id === myId) {
        map.set(otherId, { friendshipId: row.id, status: "declined_by_them" });
      }
      continue;
    }
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
  if (otherIds.length === 0) return [];

  // A friendship row isn't deleted when either side blocks the other — it
  // stays "accepted" in the DB. `is_blocked_between` sees both directions
  // (unlike a plain `blocks` select, which RLS limits to blocks I made
  // myself), so it also catches the case where the other person blocked me.
  const blocked = await Promise.all(
    otherIds.map((id) => isBlockedBetween(supabase, myId, id))
  );
  const visibleIds = otherIds.filter((_, i) => !blocked[i]);
  return getProfilesByIds(supabase, visibleIds);
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

export async function getPendingRequestsCount(
  supabase: Client,
  myId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("addressee_id", myId);
  if (error) throw error;
  return count ?? 0;
}

export class FriendRequestBlockedError extends Error {
  constructor() {
    super("A friend request cannot be sent between these two users right now.");
    this.name = "FriendRequestBlockedError";
  }
}

export async function sendFriendRequest(
  supabase: Client,
  requesterId: string,
  addresseeId: string
) {
  const { data: existing, error: fetchError } = await supabase
    .from("friendships")
    .select("id, requester_id, status")
    .or(
      `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`
    )
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (existing) {
    if (existing.status !== "declined" || existing.requester_id === requesterId) {
      throw new FriendRequestBlockedError();
    }
    // The person who declined before is the one sending now — clear the old
    // record so a fresh request in the new direction can be created.
    const { error: deleteError } = await supabase
      .from("friendships")
      .delete()
      .eq("id", existing.id);
    if (deleteError) throw deleteError;
  }

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
