"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { getProfilesByIds } from "@/lib/profile/queries";
import {
  markAllNotificationsRead,
  notificationOtherUserId,
  type EnrichedNotification,
  type NotificationRow as NotificationRowData,
} from "@/lib/notifications/queries";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationRow } from "@/components/notifications/notification-row";

export function NotificationsPageClient({
  userId,
  initialNotifications,
}: {
  userId: string;
  initialNotifications: EnrichedNotification[];
}) {
  const t = useTranslations("Notifications");
  const [notifications, setNotifications] = useState(initialNotifications);
  const [markingAll, setMarkingAll] = useState(false);
  const hasUnread = notifications.some((n) => !n.read_at);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`notifications:page:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          const newRow = payload.new as NotificationRowData;
          if (newRow.type === "new_message" || newRow.type === "friend_request") return;
          const otherId = notificationOtherUserId(newRow);
          const profiles = otherId ? await getProfilesByIds(supabase, [otherId]) : [];
          setNotifications((prev) =>
            prev.some((n) => n.id === newRow.id)
              ? prev
              : [{ ...newRow, otherProfile: profiles[0] ?? null }, ...prev]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  function handleRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      const supabase = createClient();
      await markAllNotificationsRead(supabase, userId);
      const now = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title={t("title")}
        actions={
          hasUnread ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll}
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-teal2 disabled:opacity-60"
            >
              {markingAll ? "…" : t("markAllRead")}
            </button>
          ) : undefined
        }
      />

      <div className="p-4 md:p-6">
        {notifications.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted">{t("empty")}</p>
        ) : (
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-3">
            {notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onRead={handleRead} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
