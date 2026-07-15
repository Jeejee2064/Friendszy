import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

type Client = SupabaseClient<Database>;

export type DashboardStats = {
  friendsCount: number;
  unreadCount: number;
  myInterestsCount: number;
};

export async function getDashboardStats(
  supabase: Client,
  userId: string
): Promise<DashboardStats> {
  const [friendsRes, unreadRes, interestsRes] = await Promise.all([
    supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .neq("sender_id", userId)
      .is("read_at", null),
    supabase
      .from("profile_interests")
      .select("interest_id", { count: "exact", head: true })
      .eq("profile_id", userId),
  ]);

  if (friendsRes.error) throw friendsRes.error;
  if (unreadRes.error) throw unreadRes.error;
  if (interestsRes.error) throw interestsRes.error;

  return {
    friendsCount: friendsRes.count ?? 0,
    unreadCount: unreadRes.count ?? 0,
    myInterestsCount: interestsRes.count ?? 0,
  };
}
