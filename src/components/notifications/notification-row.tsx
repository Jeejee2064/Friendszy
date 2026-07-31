"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  markNotificationRead,
  type EnrichedNotification,
} from "@/lib/notifications/queries";

export function NotificationRow({
  notification,
  onRead,
}: {
  notification: EnrichedNotification;
  onRead?: (id: string) => void;
}) {
  const t = useTranslations("Notifications");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60000 });
  const router = useRouter();

  const name = notification.otherProfile?.full_name
    ? [notification.otherProfile.full_name, notification.otherProfile.last_name]
        .filter(Boolean)
        .join(" ")
    : tCommon("deletedUser");
  const group = notification.otherGroup;
  const label =
    notification.type === "friend_added"
      ? t("friendAdded", { name })
      : notification.type === "friend_request_accepted"
        ? t("friendRequestAccepted", { name })
        : notification.type === "group_invitation" && group
          ? t("groupInvitation", { group: group.name })
          : notification.type === "group_join_request" && group
            ? t("groupJoinRequest", { name, group: group.name })
            : notification.type === "group_join_approved" && group
              ? t("groupJoinApproved", { group: group.name })
              : "";
  const isUnread = !notification.read_at;
  const profile = notification.otherProfile;
  const avatarUrl = group ? group.avatar_url : profile?.avatar_url;
  const avatarInitial = (group ? group.name : name).charAt(0).toUpperCase();

  async function handleClick() {
    if (isUnread) {
      onRead?.(notification.id);
      try {
        const supabase = createClient();
        await markNotificationRead(supabase, notification.id);
      } catch {
        // best-effort: le badge se resynchronisera au prochain événement realtime
      }
    }
    if (group) {
      router.push(`/groups/${group.id}`);
    } else {
      router.push(profile ? `/profile/${profile.id}` : "/friends");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-opacity hover:opacity-80 ${
        isUnread ? "bg-bg" : ""
      }`}
    >
      <div
        className="h-9 w-9 shrink-0 overflow-hidden rounded-full"
        style={!avatarUrl ? { backgroundImage: "var(--grad)" } : undefined}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
            {avatarInitial}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${isUnread ? "font-bold text-text" : "text-muted"}`}>{label}</p>
        <span className="text-xs text-muted">
          {format.relativeTime(new Date(notification.created_at), now)}
        </span>
      </div>
      <span className="shrink-0 self-center text-muted">→</span>
    </button>
  );
}
