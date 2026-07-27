"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { getProfilesByIds } from "@/lib/profile/queries";
import { getGroupSummariesByIds } from "@/lib/groups/queries";
import { useToast } from "@/components/ui/toast-context";
import {
  getUnreadNotificationCount,
  notificationOtherUserId,
  notificationGroupId,
  type NotificationRow,
} from "./queries";
import type { Database } from "@/types/supabase";

const NotificationsContext = createContext<number>(0);

export function useUnreadNotificationsCount() {
  return useContext(NotificationsContext);
}

function displayName(profile: { full_name: string | null; last_name: string | null }): string {
  return profile.full_name
    ? [profile.full_name, profile.last_name].filter(Boolean).join(" ")
    : "";
}

// One generic path for every notification type instead of one hardcoded
// special case per type — this used to only handle friend_request_accepted
// (friend_added had its own separate component watching the friendships
// table directly), which meant the 3 group types never toasted at all,
// only ever showing up in the Notifications tab.
async function buildToast(
  supabase: SupabaseClient<Database>,
  row: NotificationRow,
  t: ReturnType<typeof useTranslations<"Notifications">>
): Promise<{ message: string; href: string } | null> {
  const otherUserId = notificationOtherUserId(row);
  const groupId = notificationGroupId(row);

  switch (row.type) {
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
      return {
        message: t("friendRequestAccepted", { name: displayName(profile) }),
        href: "/friends",
      };
    }
    case "group_invitation": {
      if (!groupId) return null;
      const groups = await getGroupSummariesByIds(supabase, [groupId]);
      const group = groups.get(groupId);
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
      const groups = await getGroupSummariesByIds(supabase, [groupId]);
      const group = groups.get(groupId);
      if (!group) return null;
      return {
        message: t("groupJoinApproved", { group: group.name }),
        href: `/groups/${groupId}`,
      };
    }
    default:
      return null;
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const t = useTranslations("Notifications");
  const showToast = useToast();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let started = false;

    async function refresh(userId: string) {
      try {
        const value = await getUnreadNotificationCount(supabase, userId);
        if (!cancelled) setCount(value);
      } catch {
        // ignore transient errors, next event will retry
      }
    }

    async function start(userId: string) {
      if (started) return;
      started = true;

      await refresh(userId);

      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          async (payload) => {
            refresh(userId);
            const newRow = payload.new as NotificationRow;
            const toast = await buildToast(supabase, newRow, t);
            if (!cancelled && toast) showToast(toast);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          () => refresh(userId)
        )
        .subscribe();
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) start(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        start(session.user.id);
      }
      if (event === "SIGNED_OUT") {
        started = false;
        setCount(0);
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
      }
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      listener.subscription.unsubscribe();
    };
  }, [t, showToast]);

  return (
    <NotificationsContext.Provider value={count}>{children}</NotificationsContext.Provider>
  );
}
