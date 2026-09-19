import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getUnreadConversationsCount } from "@/lib/messages/queries";

type Client = SupabaseClient<Database>;

export type DashboardStats = {
  friendsCount: number;
  unreadCount: number;
  myInterestsCount: number;
  groupsCount: number;
};

export async function getDashboardStats(
  supabase: Client,
  userId: string
): Promise<DashboardStats> {
  const [friendsRes, unreadCount, interestsRes, groupsRes] = await Promise.all([
    supabase
      .from("friendships")
      .select("id", { count: "exact", head: true })
      .eq("requester_id", userId),
    // Même définition que la page /messages et le badge de la sidebar
    // (nombre de conversations non lues, en excluant celles masquées, les
    // comptes bloqués et les comptes supprimés) — avant, ceci comptait tous
    // les messages non lus en base sans aucune de ces exclusions, ce qui
    // pouvait afficher un nombre différent de tous les autres indicateurs
    // "non lu" de l'appli pour le même utilisateur au même moment.
    getUnreadConversationsCount(supabase, userId),
    supabase
      .from("profile_interests")
      .select("interest_id", { count: "exact", head: true })
      .eq("profile_id", userId),
    supabase
      .from("group_members")
      .select("group_id", { count: "exact", head: true })
      .eq("profile_id", userId)
      .eq("status", "active"),
  ]);

  if (friendsRes.error) throw friendsRes.error;
  if (interestsRes.error) throw interestsRes.error;
  if (groupsRes.error) throw groupsRes.error;

  return {
    friendsCount: friendsRes.count ?? 0,
    unreadCount,
    myInterestsCount: interestsRes.count ?? 0,
    groupsCount: groupsRes.count ?? 0,
  };
}
