import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getProfilesByIds } from "@/lib/profile/queries";
import type { ProfileSummary } from "@/lib/profile/types";

type Client = SupabaseClient<Database>;

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type EnrichedNotification = NotificationRow & { otherProfile: ProfileSummary | null };

export function notificationOtherUserId(notification: NotificationRow): string | null {
  const payload = notification.payload as Record<string, unknown> | null;
  if (!payload) return null;

  switch (notification.type) {
    case "friend_request_accepted":
      return typeof payload.addressee_id === "string" ? payload.addressee_id : null;
    default:
      return null;
  }
}

export async function getUnreadNotificationCount(
  supabase: Client,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .neq("type", "new_message")
    .neq("type", "friend_request")
    .is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function getNotificationsWithProfiles(
  supabase: Client,
  userId: string,
  limit = 30
): Promise<EnrichedNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .neq("type", "new_message")
    .neq("type", "friend_request")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = data ?? [];
  const otherIds = [
    ...new Set(rows.map(notificationOtherUserId).filter((id): id is string => !!id)),
  ];
  const profiles = await getProfilesByIds(supabase, otherIds);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return rows.map((row) => ({
    ...row,
    otherProfile: profileById.get(notificationOtherUserId(row) ?? "") ?? null,
  }));
}

export async function markNotificationRead(supabase: Client, notificationId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(supabase: Client, userId: string) {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}
