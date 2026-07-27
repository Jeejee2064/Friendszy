import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getProfilesByIds } from "@/lib/profile/queries";
import type { ProfileSummary } from "@/lib/profile/types";
import { getGroupSummariesByIds } from "@/lib/groups/queries";
import type { GroupSummary } from "@/lib/groups/types";

type Client = SupabaseClient<Database>;

export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type EnrichedNotification = NotificationRow & {
  otherProfile: ProfileSummary | null;
  otherGroup: GroupSummary | null;
};

export function notificationOtherUserId(notification: NotificationRow): string | null {
  const payload = notification.payload as Record<string, unknown> | null;
  if (!payload) return null;

  switch (notification.type) {
    case "friend_added":
      return typeof payload.requester_id === "string" ? payload.requester_id : null;
    case "friend_request_accepted":
      // Legacy type from the old mutual-consent flow — no longer created,
      // but may still exist historically.
      return typeof payload.addressee_id === "string" ? payload.addressee_id : null;
    case "group_join_request":
      return typeof payload.requester_id === "string" ? payload.requester_id : null;
    default:
      return null;
  }
}

// group_invitation and group_join_approved carry only a group_id — there's
// no "other person" for those, unlike group_join_request which has both.
export function notificationGroupId(notification: NotificationRow): string | null {
  const payload = notification.payload as Record<string, unknown> | null;
  if (!payload) return null;

  switch (notification.type) {
    case "group_invitation":
    case "group_join_request":
    case "group_join_approved":
      return typeof payload.group_id === "string" ? payload.group_id : null;
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
  profileById: Map<string, ProfileSummary>,
  groupById: Map<string, GroupSummary>
): boolean {
  const otherId = notificationOtherUserId(row);
  if (otherId && !isLiveOtherProfile(profileById.get(otherId))) return false;

  const groupId = notificationGroupId(row);
  // The group itself was deleted (e.g. the creator-leaves-empties-group
  // trigger) — same principle as hiding a notification about a gone profile.
  if (groupId && !groupById.has(groupId)) return false;

  return true;
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
  const groupIds = [
    ...new Set(rows.map(notificationGroupId).filter((id): id is string => !!id)),
  ];
  const [profiles, groupById] = await Promise.all([
    getProfilesByIds(supabase, otherIds),
    getGroupSummariesByIds(supabase, groupIds),
  ]);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return rows.filter((row) => keepNotification(row, profileById, groupById)).length;
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
  const groupIds = [
    ...new Set(rows.map(notificationGroupId).filter((id): id is string => !!id)),
  ];
  const [profiles, groupById] = await Promise.all([
    getProfilesByIds(supabase, otherIds),
    getGroupSummariesByIds(supabase, groupIds),
  ]);
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return rows
    .filter((row) => keepNotification(row, profileById, groupById))
    .map((row) => ({
      ...row,
      otherProfile: profileById.get(notificationOtherUserId(row) ?? "") ?? null,
      otherGroup: groupById.get(notificationGroupId(row) ?? "") ?? null,
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
