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

  const name = notification.otherProfile?.full_name ?? tCommon("deletedUser");
  const label =
    notification.type === "friend_request_accepted" ? t("friendRequestAccepted", { name }) : "";
  const isUnread = !notification.read_at;
  const profile = notification.otherProfile;

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
    router.push("/friends");
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
        style={!profile?.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
      >
        {profile?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <p
        className={`min-w-0 flex-1 truncate text-sm ${isUnread ? "font-bold text-text" : "text-muted"}`}
      >
        {label}
      </p>
      <span className="shrink-0 text-xs text-muted">
        {format.relativeTime(new Date(notification.created_at), now)}
      </span>
      <span className="shrink-0 text-muted">→</span>
    </button>
  );
}
