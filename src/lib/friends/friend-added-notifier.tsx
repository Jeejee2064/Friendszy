"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { getProfilesByIds } from "@/lib/profile/queries";
import { useToast } from "@/components/ui/toast-context";
import type { Database } from "@/types/supabase";

type FriendshipRow = Database["public"]["Tables"]["friendships"]["Row"];

// Shows a live toast when someone adds you as a friend. No count/badge is
// exposed here — adding a friend is instant and one-directional, so there's
// no "pending" concept left to badge (unlike the old PendingRequestsProvider
// this replaces).
export function FriendAddedNotifier({ children }: { children: ReactNode }) {
  const t = useTranslations("Notifications");
  const showToast = useToast();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let started = false;

    async function start(userId: string) {
      if (started) return;
      started = true;

      channel = supabase
        .channel(`friendships:added:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "friendships",
            filter: `addressee_id=eq.${userId}`,
          },
          async (payload) => {
            const newRow = payload.new as FriendshipRow;
            const [profile] = await getProfilesByIds(supabase, [newRow.requester_id]);
            const name = profile?.full_name ?? "";
            showToast({
              message: t("friendAdded", { name }),
              href: `/profile/${newRow.requester_id}`,
            });
          }
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

  return <>{children}</>;
}
