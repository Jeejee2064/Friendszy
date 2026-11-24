import type { SupabaseClient } from "@supabase/supabase-js";
import type { useTranslations } from "next-intl";
import type { Database } from "@/types/supabase";
import { getProfilesByIds } from "@/lib/profile/queries";
import { getGroupSummariesByIds } from "@/lib/groups/queries";
import { notificationOtherUserId, notificationGroupId, type NotificationRow } from "./queries";

export type ToastSpec = {
  message: string | ((count: number) => string);
  href: string;
  groupKey?: string;
};

type T = ReturnType<typeof useTranslations<"Notifications">>;

function displayName(profile: { full_name: string | null; last_name: string | null }): string {
  return profile.full_name ? [profile.full_name, profile.last_name].filter(Boolean).join(" ") : "";
}

// Un seul chemin pour tous les types de notification (la ligne `notifications`
// est la source de vérité, y compris pour les nouveaux messages privés).
export async function buildNotificationToast(
  supabase: SupabaseClient<Database>,
  row: NotificationRow,
  t: T
): Promise<ToastSpec | null> {
  const otherUserId = notificationOtherUserId(row);
  const groupId = notificationGroupId(row);
  const payload = (row.payload ?? {}) as Record<string, unknown>;

  switch (row.type) {
    case "new_message": {
      const senderId = typeof payload.sender_id === "string" ? payload.sender_id : null;
      const conversationId =
        typeof payload.conversation_id === "string" ? payload.conversation_id : null;
      if (!senderId || !conversationId) return null;
      const [profile] = await getProfilesByIds(supabase, [senderId]);
      const name = profile?.full_name ?? "";
      return {
        message: (count) =>
          count > 1 ? t("newMessages", { name, count }) : t("newMessage", { name }),
        href: `/messages?c=${conversationId}`,
        groupKey: `conversation:${conversationId}`,
      };
    }
    case "friend_added": {
      if (!otherUserId) return null;
      const [profile] = await getProfilesByIds(supabase, [otherUserId]);
      if (!profile) return null;
      return { message: t("friendAdded", { name: displayName(profile) }), href: `/profile/${otherUserId}` };
    }
    case "friend_request_accepted": {
      if (!otherUserId) return null;
      const [profile] = await getProfilesByIds(supabase, [otherUserId]);
      if (!profile) return null;
      return { message: t("friendRequestAccepted", { name: displayName(profile) }), href: "/friends" };
    }
    case "group_invitation": {
      if (!groupId) return null;
      const group = (await getGroupSummariesByIds(supabase, [groupId])).get(groupId);
      if (!group) return null;
      return { message: t("groupInvitation", { group: group.name }), href: `/groups/${groupId}` };
    }
    case "group_join_request": {
      if (!groupId || !otherUserId) return null;
      const [groups, profiles] = await Promise.all([
        getGroupSummariesByIds(supabase, [groupId]),
        getProfilesByIds(supabase, [otherUserId]),
      ]);
      const group = groups.get(groupId);
      const profile = profiles[0];
      if (!group || !profile) return null;
      return {
        message: t("groupJoinRequest", { name: displayName(profile), group: group.name }),
        href: `/groups/${groupId}`,
      };
    }
    case "group_join_approved": {
      if (!groupId) return null;
      const group = (await getGroupSummariesByIds(supabase, [groupId])).get(groupId);
      if (!group) return null;
      return { message: t("groupJoinApproved", { group: group.name }), href: `/groups/${groupId}` };
    }
    case "push_test":
      return { message: t("pushTest"), href: "/notifications" };
    default:
      return null;
  }
}
