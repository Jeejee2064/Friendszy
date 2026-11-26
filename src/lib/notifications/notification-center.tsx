"use client";

// Centre de notifications : UNE seule source de vérité pour tout ce qui est
// « nouveau » dans l'app (cloche, badge Messages, bannières in-app). Remplace
// les anciens NotificationsProvider et UnreadMessagesProvider, qui avaient
// chacun leur socket, leur logique de reconnexion (et celui des notifications
// n'en avait aucune : la cloche restait figée dès que la WebView avait coupé
// le socket en arrière-plan).
//
// - Un canal Realtime par utilisateur ; les messages privés passent par leur
//   ligne `notifications` (créée par le trigger notify_new_message) plutôt
//   que par un abonnement à tous les INSERT de `messages`.
// - Robustesse : reconnexion avec backoff, sondage de secours, resynchro au
//   retour au premier plan / réseau (voir onResync).
// - Pas de bannière pour ce qu'on a déjà sous les yeux (conversation ouverte,
//   chat de groupe ou d'événement affiché).

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "@/i18n/navigation";
import { getGroupSummariesByIds } from "@/lib/groups/queries";
import { useToast } from "@/components/ui/toast-context";
import { useActiveConversationId } from "@/lib/messages/active-conversation-context";
import {
  getUnreadConversationsCount,
  markAllReceivedMessagesDelivered,
  markMessageDelivered,
} from "@/lib/messages/queries";
import { onResync } from "@/lib/realtime/resync";
import { clearDeliveredMessageNotifications } from "@/lib/push/native";
import { getUnreadNotificationCount, type NotificationRow } from "./queries";
import { buildNotificationToast } from "./build-toast";
import type { Database } from "@/types/supabase";

type Counts = { notifications: number; messages: number };

const CenterContext = createContext<Counts>({ notifications: 0, messages: 0 });

export function useUnreadNotificationsCount() {
  return useContext(CenterContext).notifications;
}

export function useUnreadConversationsCount() {
  return useContext(CenterContext).messages;
}

// Filet de sécurité indépendant de l'état du canal (un socket peut cesser de
// livrer sans jamais lever d'erreur).
const POLL_MS = 30_000;
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 30_000;
const SEEN_MAX = 200;

type GroupMessageRow = Database["public"]["Tables"]["group_messages"]["Row"];
type EventMessageRow = Database["public"]["Tables"]["event_messages"]["Row"];

export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const [counts, setCounts] = useState<Counts>({ notifications: 0, messages: 0 });
  const t = useTranslations("Notifications");
  const showToast = useToast();
  const pathname = usePathname();
  const activeConversationId = useActiveConversationId();

  // Le canal n'est monté qu'une fois : tout ce qui change ensuite (langue,
  // page affichée, conversation ouverte) passe par des refs.
  const tRef = useRef(t);
  const showToastRef = useRef(showToast);
  const pathnameRef = useRef(pathname);
  const activeConversationRef = useRef<string | null>(activeConversationId);
  const countsRef = useRef(counts);
  useEffect(() => {
    tRef.current = t;
    showToastRef.current = showToast;
    pathnameRef.current = pathname;
    activeConversationRef.current = activeConversationId;
    countsRef.current = counts;
  }, [t, showToast, pathname, activeConversationId, counts]);

  // Badge d'icône (PWA installée : iOS 16.4+, Chrome/Edge desktop) — pendant
  // « app ouverte » du setAppBadge de sw.js ; reflète le compte exact.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    const apply = counts.messages > 0 ? navigator.setAppBadge(counts.messages) : navigator.clearAppBadge();
    apply.catch(() => {});
  }, [counts.messages]);

  // Notifications système (app native) : retirées dès que les messages sont
  // lus, et revérifiées au retour au premier plan (lecture faite ailleurs).
  useEffect(() => {
    void clearDeliveredMessageNotifications(activeConversationId, counts.messages);
    const onVisible = () => {
      if (document.visibilityState === "visible")
        void clearDeliveredMessageNotifications(activeConversationRef.current, countsRef.current.messages);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [activeConversationId, counts.messages]);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    let userId: string | null = null;
    let attempt = 0;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let stopResync: (() => void) | null = null;
    const seen = new Set<string>();
    const groupNames = new Map<string, string>();
    const eventTitles = new Map<string, string>();

    async function refreshNotifications() {
      if (!userId) return;
      try {
        const value = await getUnreadNotificationCount(supabase, userId);
        if (!cancelled) setCounts((c) => (c.notifications === value ? c : { ...c, notifications: value }));
      } catch {
        // erreur passagère : le prochain événement ou sondage réessaiera
      }
    }

    async function refreshMessages() {
      if (!userId) return;
      try {
        const value = await getUnreadConversationsCount(supabase, userId);
        if (!cancelled) setCounts((c) => (c.messages === value ? c : { ...c, messages: value }));
      } catch {
        // idem
      }
    }

    function refreshAll() {
      void refreshNotifications();
      void refreshMessages();
    }

    // Le même événement peut arriver deux fois (reconnexion qui rejoue, canal
    // recréé) : on ne traite chaque notification qu'une fois.
    function firstTime(id: string): boolean {
      if (seen.has(id)) return false;
      seen.add(id);
      if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value as string);
      return true;
    }

    async function onNotificationInsert(row: NotificationRow) {
      if (!firstTime(row.id)) return;

      if (row.type === "new_message") {
        void refreshMessages();
        const payload = (row.payload ?? {}) as Record<string, unknown>;
        const messageId = typeof payload.message_id === "string" ? payload.message_id : null;
        // « Distribué » = reçu par l'appareil du destinataire.
        (messageId
          ? markMessageDelivered(supabase, messageId)
          : userId
            ? markAllReceivedMessagesDelivered(supabase, userId)
            : Promise.resolve()
        ).catch(() => {});
        // Conversation déjà à l'écran : elle affiche le message directement.
        if (payload.conversation_id === activeConversationRef.current) return;
      } else {
        void refreshNotifications();
      }

      const toast = await buildNotificationToast(supabase, row, tRef.current);
      if (!cancelled && toast) showToastRef.current(toast);
    }

    async function onGroupMessage(row: GroupMessageRow) {
      if (row.sender_id === userId || !firstTime(`gm:${row.id}`)) return;
      if (pathnameRef.current.startsWith(`/groups/${row.group_id}`)) return;
      let name = groupNames.get(row.group_id);
      if (!name) {
        name = (await getGroupSummariesByIds(supabase, [row.group_id])).get(row.group_id)?.name;
        if (name) groupNames.set(row.group_id, name);
      }
      if (cancelled || !name) return;
      const group = name;
      showToastRef.current({
        message: (count) =>
          count > 1
            ? tRef.current("newGroupMessages", { group, count })
            : tRef.current("newGroupMessage", { group }),
        href: `/groups/${row.group_id}`,
        groupKey: `group:${row.group_id}`,
      });
    }

    async function onEventMessage(row: EventMessageRow) {
      if (row.sender_id === userId || !firstTime(`em:${row.id}`)) return;
      if (pathnameRef.current.startsWith(`/events/${row.event_id}`)) return;
      let title = eventTitles.get(row.event_id);
      if (!title) {
        const { data } = await supabase.from("events").select("title").eq("id", row.event_id).maybeSingle();
        title = data?.title;
        if (title) eventTitles.set(row.event_id, title);
      }
      if (cancelled || !title) return;
      const event = title;
      showToastRef.current({
        message: (count) =>
          count > 1
            ? tRef.current("newEventMessages", { event, count })
            : tRef.current("newEventMessage", { event }),
        href: `/events/${row.event_id}`,
        groupKey: `event:${row.event_id}`,
      });
    }

    function teardownChannel() {
      const closing = channel;
      // Nuller AVANT removeChannel : removeChannel peut rappeler le callback de
      // statut (CLOSED) de façon synchrone ; sans ça, récursion infinie.
      channel = null;
      if (closing) void supabase.removeChannel(closing);
    }

    function scheduleRetry() {
      if (retryTimeout || cancelled) return;
      const delay = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
      attempt += 1;
      retryTimeout = setTimeout(() => {
        retryTimeout = null;
        if (!cancelled && userId) subscribe(userId);
      }, delay);
    }

    function subscribe(uid: string) {
      teardownChannel();
      const own = `user_id=eq.${uid}`;
      channel = supabase
        .channel(`center:${uid}:${Date.now()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: own },
          (payload) => void onNotificationInsert(payload.new as NotificationRow)
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: own },
          () => void refreshNotifications()
        )
        // read_at posé sur un message reçu (ici ou sur un autre appareil).
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "messages" },
          () => void refreshMessages()
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "group_messages" },
          (payload) => void onGroupMessage(payload.new as GroupMessageRow)
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "event_messages" },
          (payload) => void onEventMessage(payload.new as EventMessageRow)
        )
        .subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            attempt = 0;
            // Rattrape tout ce qui a pu arriver pendant la coupure.
            refreshAll();
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            teardownChannel();
            scheduleRetry();
          }
        });
    }

    async function start(uid: string) {
      if (userId === uid) return;
      stop();
      userId = uid;
      refreshAll();
      subscribe(uid);
      pollInterval = setInterval(() => {
        if (document.visibilityState === "visible") refreshAll();
      }, POLL_MS);
      let lastResync = 0;
      stopResync = onResync(() => {
        refreshAll();
        // visibilitychange + pageshow + online se déclenchent souvent ensemble.
        if (Date.now() - lastResync < 5_000) return;
        lastResync = Date.now();
        // Après un long passage en arrière-plan le socket est souvent mort sans
        // signal : on repart sur un canal neuf.
        subscribe(uid);
      });
    }

    function stop() {
      userId = null;
      attempt = 0;
      teardownChannel();
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = null;
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = null;
      stopResync?.();
      stopResync = null;
      seen.clear();
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) void start(data.user.id);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) void start(session.user.id);
      if (event === "SIGNED_OUT") {
        stop();
        setCounts({ notifications: 0, messages: 0 });
      }
    });

    return () => {
      cancelled = true;
      stop();
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => counts, [counts]);
  return <CenterContext.Provider value={value}>{children}</CenterContext.Provider>;
}
