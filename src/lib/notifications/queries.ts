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

// A notification tied to another user (payload.addressee_id, etc.) becomes
// noise once that user's account is deleted — deleteMyAccount anonymizes
// the profiles row in place (full_name → null) rather than removing it, and
// that's the only reliable "this account is gone" signal available (no
// deleted_at column). Filter those out everywhere a notification list is
// built, instead of showing a dead "Deleted user" entry.
function isLiveOtherProfile(profile: ProfileSummary | null | undefined): boolean {
  return !!profile && profile.full_name !== null;
}

function keepNotification(
  row: NotificationRow,
  profileById: Map<string, ProfileSummary>
): boolean {
  const otherId = notificationOtherUserId(row);
  if (!otherId) return true;
  return isLiveOtherProfile(profileById.get(otherId));
}

export async function getUnreadNotificationCount(
  supabase: Client,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, payload")
    .eq("user_id", userId)
    .neq("type", "new_message")
    .neq("type", "friend_request")
    .is("read_at", null);
  if (error) throw error;

  const rows = (data ?? []) as NotificationRow[];
  const otherIds = [
    ...new Set(rows.map(notificationOtherUserId).filter((id): id is string => !!id)),
  ];
  const profiles = await getProfilesByIds(supabase, otherIds);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return rows.filter((row) => keepNotification(row, profileById)).length;
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

  return rows
    .filter((row) => keepNotification(row, profileById))
    .map((row) => ({
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
