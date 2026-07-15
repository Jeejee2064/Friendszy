import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getInterests, getMyInterestIds, getMyProfile } from "@/lib/profile/queries";
import { listFriends, listPendingRequests } from "@/lib/friends/queries";
import { listBlockedProfiles } from "@/lib/blocks/queries";

type Client = SupabaseClient<Database>;

export async function getExportData(supabase: Client, userId: string) {
  const [
    profile,
    interests,
    myInterestIds,
    friends,
    pendingRequests,
    blockedProfiles,
    sentMessages,
    myReports,
  ] = await Promise.all([
    getMyProfile(supabase, userId),
    getInterests(supabase),
    getMyInterestIds(supabase, userId),
    listFriends(supabase, userId),
    listPendingRequests(supabase, userId),
    listBlockedProfiles(supabase),
    supabase
      .from("messages")
      .select("id, conversation_id, content, created_at, read_at")
      .eq("sender_id", userId)
      .then(({ data, error }) => {
        if (error) throw error;
        return data ?? [];
      }),
    supabase
      .from("reports")
      .select("id, target_type, target_id, reason, status, created_at, resolved_at")
      .eq("reporter_id", userId)
      .then(({ data, error }) => {
        if (error) throw error;
        return data ?? [];
      }),
  ]);

  const interestLabelById = new Map(interests.map((i) => [i.id, i.label_fr]));

  return {
    exportedAt: new Date().toISOString(),
    profile,
    interests: myInterestIds.map((id) => interestLabelById.get(id) ?? id),
    friends,
    pendingRequests: pendingRequests.map((r) => r.profile),
    blockedProfiles,
    sentMessages,
    myReports,
  };
}
