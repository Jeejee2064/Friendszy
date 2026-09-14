"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { getProfilesByIds } from "@/lib/profile/queries";
import { useToast } from "@/components/ui/toast-context";
import { useActiveConversationId } from "./active-conversation-context";
import {
  getUnreadConversationsCount,
  markAllReceivedMessagesDelivered,
  markMessageDelivered,
  type MessageRow,
} from "./queries";

const UnreadMessagesContext = createContext<number>(0);

export function useUnreadConversationsCount() {
  return useContext(UnreadMessagesContext);
}

export function UnreadMessagesProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const t = useTranslations("Notifications");
  const showToast = useToast();

  // Conversation actuellement ouverte à l'écran (posée par ConversationPane
  // via ActiveConversationProvider), lue dans un ref plutôt que capturée
  // directement : la souscription realtime ci-dessous n'est montée qu'une
  // fois, alors que ceci change à chaque navigation — sans le ref, le
  // handler d'INSERT verrait toujours sa valeur du premier rendu.
  const activeConversationId = useActiveConversationId();
  const openConversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    openConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let started = false;

    async function refresh(userId: string) {
      try {
        const value = await getUnreadConversationsCount(supabase, userId);
        if (!cancelled) setCount(value);
      } catch {
        // ignore transient errors, next event will retry
      }
    }

    async function start(userId: string) {
      if (started) return;
      started = true;

      await refresh(userId);
      markAllReceivedMessagesDelivered(supabase, userId).catch(() => {
        // Best-effort catch-up; a future event or app load will retry.
      });

      channel = supabase
        .channel(`messages:unread:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          async (payload) => {
            refresh(userId);
            const newMessage = payload.new as MessageRow;
            if (newMessage.sender_id === userId) return;
            markMessageDelivered(supabase, newMessage.id).catch(() => {});
            // Déjà en train de regarder cette conversation (elle affiche le
            // message directement) — le toast serait redondant. Voir aussi
            // conversation_presence côté serveur, qui évite la même
            // redondance pour la notif push.
            if (newMessage.conversation_id === openConversationIdRef.current) return;
            const [profile] = await getProfilesByIds(supabase, [newMessage.sender_id]);
            const name = profile?.full_name ?? "";
            showToast({
              message: t("newMessage", { name }),
              href: `/messages?c=${newMessage.conversation_id}`,
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
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
    <UnreadMessagesContext.Provider value={count}>{children}</UnreadMessagesContext.Provider>
  );
}
