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

// Filet de sécurité indépendant du statut du canal Realtime : un socket peut
// s'arrêter de livrer des événements sans jamais lever CHANNEL_ERROR/
// TIMED_OUT/CLOSED (voir le même constat et le même remède dans
// ConversationPane, messages-page-client.tsx) — sans ce sondage, le badge
// reste bloqué sur une valeur périmée jusqu'au prochain rechargement complet
// de la page.
const POLL_MS = 10000;

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

  // App icon badge (iOS 16.4+ home-screen web apps, Chrome/Edge desktop
  // installed PWAs) — foreground/open-app counterpart of the setAppBadge
  // call in sw.js's push handler, which covers the app-closed case. This
  // one is the source of truth once the app is open: it reflects the exact
  // count (including the conversation_hides exclusion the push-time count
  // skips) and clears the badge as soon as messages are read.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    const apply = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
    apply.catch(() => {});
  }, [count]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let started = false;
    let currentUserId: string | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    async function refresh(userId: string) {
      try {
        const value = await getUnreadConversationsCount(supabase, userId);
        if (!cancelled) setCount(value);
      } catch {
        // ignore transient errors, next event/poll will retry
      }
    }

    function subscribe(userId: string) {
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
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            refresh(userId);
            return;
          }

          // Le socket a coupé (blip réseau, throttling d'onglet en
          // arrière-plan, ...) — sans reconnexion, plus aucun événement
          // n'arrive et le badge reste figé jusqu'au rechargement.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            // Nuller channel AVANT removeChannel : removeChannel peut
            // ré-invoquer ce même callback de statut de façon synchrone
            // (avec CLOSED) avant même de retourner. Sans ce nullage
            // préalable, l'appel ré-entrant voit encore l'ancien channel et
            // rappelle removeChannel dessus, qui se ré-invoque à nouveau...
            // récursion synchrone infinie -> RangeError (stack overflow).
            const closingChannel = channel;
            channel = null;
            if (closingChannel) {
              supabase.removeChannel(closingChannel);
            }
            retryTimeout = setTimeout(() => {
              retryTimeout = null;
              if (!cancelled) subscribe(userId);
            }, 2000);
          }
        });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible" && currentUserId && !cancelled) {
        refresh(currentUserId);
      }
    }

    async function start(userId: string) {
      if (started) return;
      started = true;
      currentUserId = userId;

      await refresh(userId);
      markAllReceivedMessagesDelivered(supabase, userId).catch(() => {
        // Best-effort catch-up; a future event or app load will retry.
      });

      subscribe(userId);
      pollInterval = setInterval(() => refresh(userId), POLL_MS);
      document.addEventListener("visibilitychange", handleVisibilityChange);
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
        currentUserId = null;
        setCount(0);
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        if (retryTimeout) {
          clearTimeout(retryTimeout);
          retryTimeout = null;
        }
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
      if (retryTimeout) clearTimeout(retryTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      listener.subscription.unsubscribe();
    };
  }, [t, showToast]);

  return (
    <UnreadMessagesContext.Provider value={count}>{children}</UnreadMessagesContext.Provider>
  );
}
