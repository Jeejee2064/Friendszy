"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  sendMessage,
  removeMessage,
  markConversationRead,
  getOrCreateConversation,
  getUnreadCountsByConversation,
  listMessages,
  listMessageReactions,
  setMessageReaction,
  removeMessageReaction,
  trackConversationPresence,
  clearConversationPresence,
  type MessageRow,
  type MessageReactionRow,
} from "@/lib/messages/queries";
import { listFriends } from "@/lib/friends/queries";
import { isBlockedBetween, haveIBlocked } from "@/lib/blocks/queries";
import type { ProfileSummary } from "@/lib/profile/types";
import { MessageBubble } from "@/components/messages/message-bubble";
import { ReplyPreviewBar } from "@/components/chat/reply-preview-bar";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { typingLabel } from "@/lib/chat/typing-label";
import { OnlineDot } from "@/components/social/online-dot";
import { BlockButton } from "@/components/social/block-button";
import { ReportButton } from "@/components/social/report-button";
import { PageHeader } from "@/components/layout/page-header";
import { Modal } from "@/components/ui/modal";
import { usePresence } from "@/lib/presence/presence-context";
import { useSetActiveConversationId } from "@/lib/messages/active-conversation-context";
import { useToast } from "@/components/ui/toast-context";
import { PushPermissionBanner } from "@/components/push/push-permission-banner";

// Fenêtre de rafraîchissement de la présence de conversation (voir
// trackConversationPresence) — nettement en dessous des 20s de fraîcheur
// côté push-new-message pour ne jamais laisser la ligne devenir périmée
// pendant qu'on regarde encore la conversation.
const PRESENCE_HEARTBEAT_MS = 15000;

type ConversationSummary = {
  id: string;
  otherProfile: ProfileSummary;
  preview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

function displayName(
  profile: { full_name: string | null; last_name: string | null },
  deletedLabel: string
): string {
  return profile.full_name
    ? [profile.full_name, profile.last_name].filter(Boolean).join(" ")
    : deletedLabel;
}

function Avatar({
  profile,
  size,
  deletedUserLabel = "?",
}: {
  profile: ProfileSummary;
  size: "sm" | "md";
  deletedUserLabel?: string;
}) {
  const dim = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  return (
    <div
      className={`${dim} overflow-hidden rounded-full`}
      style={!profile.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
    >
      {profile.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
          {(profile.full_name ?? deletedUserLabel).charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

export function MessagesPageClient({
  userId,
  conversations: initialConversations,
  selectedConversationId,
  selectedOtherProfile,
  initialMessages,
  initialReactions,
}: {
  userId: string;
  conversations: ConversationSummary[];
  selectedConversationId: string | null;
  selectedOtherProfile: ProfileSummary | null;
  initialMessages: MessageRow[];
  initialReactions: MessageReactionRow[];
}) {
  const t = useTranslations("Messages");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60000 });
  const hasSelection = !!selectedConversationId && !!selectedOtherProfile;
  const [search, setSearch] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [conversations, setConversations] = useState(initialConversations);
  // Re-sync from the server on every navigation (e.g. opening a different
  // conversation re-fetches this list with fresh unread counts) — the
  // realtime subscription below only carries updates from here forward.
  // Adjusting state during render (not in an effect) per React's guidance
  // for "reset state when a prop changes".
  const [syncedFrom, setSyncedFrom] = useState(initialConversations);
  if (initialConversations !== syncedFrom) {
    setSyncedFrom(initialConversations);
    setConversations(initialConversations);
  }

  // Keeps the conversation list (preview, timestamp, unread count, order)
  // live — without this, only the sidebar's unread badge (a separate
  // subscription) updated in real time, while this list stayed frozen
  // until a refresh or opening the conversation.
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`messages:list:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as MessageRow;
          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === m.conversation_id);
            if (idx === -1) return prev;
            const updated = [...prev];
            const conv = updated[idx];
            updated[idx] = {
              ...conv,
              preview: m.content,
              lastMessageAt: m.created_at,
              unreadCount:
                m.sender_id === userId ? conv.unreadCount : conv.unreadCount + 1,
            };
            updated.sort((a, b) =>
              (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? "")
            );
            return updated;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        async (payload) => {
          const conversationId = (payload.new as MessageRow).conversation_id;
          const counts = await getUnreadCountsByConversation(
            supabase,
            [conversationId],
            userId
          );
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? { ...c, unreadCount: counts.get(conversationId) ?? 0 }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((c) =>
      displayName(c.otherProfile, tCommon("deletedUser")).toLowerCase().includes(query)
    );
  }, [conversations, search, tCommon]);

  const unreadConversations = filtered.filter((c) => c.unreadCount > 0);
  const readConversations = filtered.filter((c) => c.unreadCount === 0);
  const totalUnread = unreadConversations.length;

  function renderConversationRow(c: ConversationSummary) {
    const name = displayName(c.otherProfile, tCommon("deletedUser"));
    const isUnread = c.unreadCount > 0;
    return (
      <Link
        key={c.id}
        href={`/messages?c=${c.id}`}
        className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-bg ${
          selectedConversationId === c.id ? "bg-bg" : ""
        }`}
      >
        <div className="relative shrink-0">
          <Avatar profile={c.otherProfile} size="md" deletedUserLabel={tCommon("deletedUser")} />
          <OnlineDot
            userId={c.otherProfile.id}
            className="absolute bottom-0 right-0 h-3 w-3"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate ${isUnread ? "font-extrabold text-text" : "font-bold text-text"}`}>
              {name}
            </p>
            {c.lastMessageAt && (
              <span className="shrink-0 text-xs text-muted">
                {format.relativeTime(new Date(c.lastMessageAt), now)}
              </span>
            )}
          </div>
          <p className={`truncate text-sm ${isUnread ? "font-bold text-text" : "text-muted"}`}>
            {c.preview ?? t("noMessagesYet")}
          </p>
        </div>
        {isUnread && (
          <span
            className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {c.unreadCount}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <PageHeader title={t("title")} />
      <PushPermissionBanner />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4 md:p-6">
        <div
          className={`min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card lg:flex lg:w-80 ${
            hasSelection ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="font-bold text-text">{t("conversationsTitle")}</h2>
              <button
                type="button"
                onClick={() => setNewConversationOpen(true)}
                title={t("newConversation")}
                aria-label={t("newConversation")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl text-white leading-none"
                style={{ backgroundImage: "var(--grad)" }}
              >
                +
              </button>
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`🔍 ${t("searchPlaceholder")}`}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-teal2"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">{t("noConversations")}</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted">{t("noSearchResults")}</p>
            ) : (
              <>
                {unreadConversations.length > 0 && (
                  <>
                    <p className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-teal2">
                      {t("unreadSection", { count: totalUnread })}
                    </p>
                    {unreadConversations.map(renderConversationRow)}
                  </>
                )}
                {readConversations.length > 0 && (
                  <>
                    <p className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wide text-muted">
                      {t("readSection")}
                    </p>
                    {readConversations.map(renderConversationRow)}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div
          className={`min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card ${
            hasSelection ? "flex" : "hidden lg:flex"
          }`}
        >
          {hasSelection ? (
            <ConversationPane
              key={selectedConversationId}
              conversationId={selectedConversationId!}
              userId={userId}
              otherProfile={selectedOtherProfile!}
              initialMessages={initialMessages}
              initialReactions={initialReactions}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">
              {t("selectConversation")}
            </div>
          )}
        </div>
      </div>

      <NewConversationModal
        open={newConversationOpen}
        onClose={() => setNewConversationOpen(false)}
        userId={userId}
      />
    </div>
  );
}

function NewConversationModal({
  open,
  onClose,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
}) {
  const t = useTranslations("Messages");
  const tFriends = useTranslations("Friends");
  const tCommon = useTranslations("Common");
  const tNav = useTranslations("Nav");
  const router = useRouter();

  const [loaded, setLoaded] = useState(false);
  const [friends, setFriends] = useState<ProfileSummary[]>([]);
  const [search, setSearch] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    const supabase = createClient();
    listFriends(supabase, userId)
      .then(setFriends)
      .then(() => setLoaded(true))
      .catch(() => {});
  }, [open, loaded, userId]);

  function handleClose() {
    setSearch("");
    onClose();
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter((f) =>
      displayName(f, tCommon("deletedUser")).toLowerCase().includes(query)
    );
  }, [friends, search, tCommon]);

  async function handlePick(friendId: string) {
    setOpeningId(friendId);
    try {
      const supabase = createClient();
      const conversationId = await getOrCreateConversation(supabase, userId, friendId);
      handleClose();
      router.push(`/messages?c=${conversationId}`);
    } catch {
      setOpeningId(null);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={t("newConversation")}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={`🔍 ${t("searchPlaceholder")}`}
        className="mb-3 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-teal2"
      />
      <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {!loaded ? (
          <p className="p-4 text-center text-sm text-muted">{t("loading")}</p>
        ) : friends.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <p className="text-sm text-muted">{tFriends("noFriends")}</p>
            <Link
              href="/search"
              onClick={handleClose}
              className="rounded-full px-5 py-2 text-sm font-bold text-white"
              style={{ backgroundImage: "var(--grad)" }}
            >
              🔍 {tNav("search")}
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted">{t("noSearchResults")}</p>
        ) : (
          filtered.map((friend) => (
            <button
              key={friend.id}
              type="button"
              onClick={() => handlePick(friend.id)}
              disabled={openingId !== null}
              className="flex items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-bg disabled:opacity-60"
            >
              <Avatar profile={friend} size="sm" deletedUserLabel={tCommon("deletedUser")} />
              <p className="min-w-0 flex-1 truncate font-semibold text-text">
                {displayName(friend, tCommon("deletedUser"))}
              </p>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}

function dayDividerLabel(
  date: Date,
  format: ReturnType<typeof useFormatter>,
  t: ReturnType<typeof useTranslations<"Messages">>
): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, now)) return t("today");
  if (sameDay(date, yesterday)) return t("yesterday");
  return format.dateTime(date, { day: "numeric", month: "long" });
}

function ConversationPane({
  conversationId,
  userId,
  otherProfile,
  initialMessages,
  initialReactions,
}: {
  conversationId: string;
  userId: string;
  otherProfile: ProfileSummary;
  initialMessages: MessageRow[];
  initialReactions: MessageReactionRow[];
}) {
  const t = useTranslations("Messages");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const router = useRouter();
  const showToast = useToast();
  const setActiveConversationId = useSetActiveConversationId();
  const onlineIds = usePresence();
  const isOnline = onlineIds.has(otherProfile.id);
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [reactions, setReactions] = useState<MessageReactionRow[]>(initialReactions);
  const [replyingTo, setReplyingTo] = useState<MessageRow | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [matchIndex, setMatchIndex] = useState(0);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const closingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const messageInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otherTypingStaleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);

  const otherDisplayName = displayName(otherProfile, tCommon("deletedUser"));
  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, MessageReactionRow[]>();
    for (const r of reactions) {
      const list = map.get(r.message_id);
      if (list) list.push(r);
      else map.set(r.message_id, [r]);
    }
    return map;
  }, [reactions]);

  function jumpToMessage(messageId: string) {
    messageRefs.current.get(messageId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(messageId);
    setTimeout(() => setHighlightedId((prev) => (prev === messageId ? null : prev)), 1500);
  }

  const searchMatches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return messages
      .filter((m) => !m.removed_at && m.content?.toLowerCase().includes(query))
      .map((m) => m.id);
  }, [messages, searchQuery]);

  // Recentre sur le premier résultat à chaque nouvelle recherche, en même
  // temps que le changement de valeur plutôt que dans un effet séparé —
  // sans ça, matchIndex resterait bloqué sur un index qui n'existe plus
  // dans la nouvelle liste de correspondances.
  function handleSearchQueryChange(value: string) {
    setSearchQuery(value);
    setMatchIndex(0);
    const query = value.trim().toLowerCase();
    if (!query) return;
    const firstMatch = messages.find((m) => !m.removed_at && m.content?.toLowerCase().includes(query));
    if (firstMatch) jumpToMessage(firstMatch.id);
  }

  function goToMatch(offset: number) {
    if (searchMatches.length === 0) return;
    const next = (matchIndex + offset + searchMatches.length) % searchMatches.length;
    setMatchIndex(next);
    jumpToMessage(searchMatches[next]);
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setMatchIndex(0);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const mine = reactionsByMessageId.get(messageId)?.find((r) => r.user_id === userId);
    const supabase = createClient();
    try {
      if (mine?.emoji === emoji) {
        await removeMessageReaction(supabase, messageId, userId);
        setReactions((prev) =>
          prev.filter((r) => !(r.message_id === messageId && r.user_id === userId))
        );
      } else {
        const saved = await setMessageReaction(supabase, messageId, userId, emoji);
        setReactions((prev) => [
          ...prev.filter((r) => !(r.message_id === messageId && r.user_id === userId)),
          saved,
        ]);
      }
    } catch {
      // ignore — the realtime event (or next catchUp) reconciles the true state
    }
  }

  async function handleDeleteMessage(messageId: string) {
    const supabase = createClient();
    try {
      await removeMessage(supabase, messageId, userId);
      // Optimistic: the realtime UPDATE handler below also reflects this,
      // but applying it locally right away avoids a visible round-trip.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, removed_at: new Date().toISOString(), removed_by: userId }
            : m
        )
      );
    } catch {
      // ignore — the realtime event (or next catchUp) reconciles the true state
    }
  }

  // Debounced typing broadcast via presence on the conversation channel
  // (see channelRef, set by the subscribe effect below) — presence untracks
  // automatically on disconnect, so a torn-down tab never leaves a stuck
  // "typing..." for the other person.
  function stopTyping() {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      channelRef.current?.track({ typing: false });
    }
  }

  function handleContentChange(value: string) {
    setContent(value);
    if (!channelRef.current) return;
    if (value.trim().length === 0) {
      stopTyping();
      return;
    }
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      channelRef.current.track({ typing: true });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 3000);
  }

  async function closeDueToBlock(byMe: boolean) {
    if (closingRef.current) return;
    closingRef.current = true;
    showToast({
      message: byMe
        ? t("blockedByYou", { name: otherDisplayName })
        : t("blockedByThem"),
      href: "/messages",
    });
    router.push("/messages");
    router.refresh();
  }

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function checkBlocked() {
      if (cancelled || closingRef.current) return;
      try {
        const blocked = await isBlockedBetween(supabase, userId, otherProfile.id);
        if (!blocked || cancelled) return;
        const byMe = await haveIBlocked(supabase, userId, otherProfile.id);
        closeDueToBlock(byMe);
      } catch {
        // ignore transient errors, next check will retry
      }
    }

    checkBlocked();
    const interval = setInterval(checkBlocked, 8000);
    document.addEventListener("visibilitychange", checkBlocked);
    window.addEventListener("focus", checkBlocked);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", checkBlocked);
      window.removeEventListener("focus", checkBlocked);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, userId, otherProfile.id]);

  // Signale "je regarde cette conversation" tant qu'elle est ouverte à
  // l'écran : côté serveur, un heartbeat pour que push-new-message
  // n'envoie pas de notif push pour un message qu'on est déjà en train de
  // lire ; côté client, ActiveConversationContext pour que le toast
  // in-app (unread-context.tsx) ne fasse pas la même redondance. Onglet
  // masqué → on efface tout de suite la présence serveur au lieu d'attendre
  // qu'elle devienne périmée, pour que le push reparte sans délai si on
  // quitte l'appli à ce moment-là ; ActiveConversationContext, lui, reste
  // posé tant que le composant est monté (revenir sur l'onglet ne doit pas
  // faire réapparaître le toast pour cette même conversation).
  useEffect(() => {
    setActiveConversationId(conversationId);
    return () => setActiveConversationId(null);
  }, [conversationId, setActiveConversationId]);

  useEffect(() => {
    const supabase = createClient();
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    function start() {
      trackConversationPresence(supabase, userId, conversationId).catch(() => {});
      if (!heartbeat) {
        heartbeat = setInterval(() => {
          trackConversationPresence(supabase, userId, conversationId).catch(() => {});
        }, PRESENCE_HEARTBEAT_MS);
      }
    }

    function stop() {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      clearConversationPresence(supabase, userId).catch(() => {});
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", stop);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", stop);
      stop();
    };
  }, [conversationId, userId]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    // Re-pulls the full message list and read state from the DB — used to
    // catch up after (re)connecting, since events missed while the channel
    // was down (dropped socket, backgrounded tab, ...) are otherwise lost
    // for good and ticks/messages silently go stale until a hard refresh.
    async function catchUp() {
      try {
        const [fresh, freshReactions] = await Promise.all([
          listMessages(supabase, conversationId),
          listMessageReactions(supabase, conversationId),
        ]);
        if (!cancelled) {
          setMessages(fresh);
          setReactions(freshReactions);
        }
      } catch {
        // ignore transient errors, next reconnect/visibility change retries
      }
      markConversationRead(supabase, conversationId, userId).catch((err) =>
        console.error("markConversationRead failed", err)
      );
    }

    function subscribe() {
      channel = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const newMessage = payload.new as MessageRow;
            setMessages((prev) =>
              prev.some((m) => m.id === newMessage.id) ? prev : [...prev, newMessage]
            );
            if (newMessage.sender_id !== userId) {
              markConversationRead(supabase, conversationId, userId).catch((err) =>
        console.error("markConversationRead failed", err)
      );
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const updated = payload.new as MessageRow;
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "message_reactions",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as MessageReactionRow;
            setReactions((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "message_reactions",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as MessageReactionRow;
            setReactions((prev) => prev.map((r) => (r.id === row.id ? row : r)));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "message_reactions",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const oldRow = payload.old as { id: string };
            setReactions((prev) => prev.filter((r) => r.id !== oldRow.id));
          }
        )
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            catchUp();
            return;
          }

          // The socket dropped (network blip, background-tab throttling,
          // etc.) — without this, INSERT/UPDATE events (new messages, read
          // ticks) silently stop arriving until the page is refreshed.
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (channel) {
              supabase.removeChannel(channel);
              channel = null;
            }
            retryTimeout = setTimeout(() => {
              retryTimeout = null;
              if (!cancelled) subscribe();
            }, 2000);
          }
        });
    }

    markConversationRead(supabase, conversationId, userId).catch((err) =>
      console.error("markConversationRead failed", err)
    );
    subscribe();

    // Filet de sécurité : un channel Realtime peut arrêter de livrer des
    // événements sans jamais lever CHANNEL_ERROR/TIMED_OUT/CLOSED (socket
    // à moitié mort — le client le croit toujours "joined"), ce qui a
    // laissé des messages invisibles jusqu'au rechargement de la page.
    // Un re-fetch complet toutes les 5s, indépendant du statut du channel,
    // garantit qu'un message manqué apparaît quand même sous peu — sans
    // avoir à diagnostiquer la cause exacte côté Realtime.
    const pollInterval = setInterval(catchUp, 5000);

    // Background tabs get their sockets throttled by the browser; make sure
    // we're still actually connected (and caught up) once it's foregrounded.
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible" || cancelled) return;
      if (channel?.state === "joined") {
        catchUp();
        return;
      }
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
      subscribe();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
      if (retryTimeout) clearTimeout(retryTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  // Présence "en train d'écrire" — sur un channel SÉPARÉ de celui des
  // postgres_changes ci-dessus, pour qu'un souci dessus n'affecte jamais
  // la réception des messages (voir le channel `conversation:${id}`
  // ci-dessus). Filet de sécurité en plus : otherTyping se réinitialise
  // tout seul après STALE_TYPING_MS sans confirmation fraîche — même si un
  // événement "typing: false" se perd en route, l'indicateur ne peut pas
  // rester bloqué indéfiniment.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function syncTyping(current: RealtimeChannel) {
      const state = current.presenceState<{ typing?: boolean }>();
      const entries = state[otherProfile.id] ?? [];
      const typing = entries.some((entry) => entry.typing);
      setOtherTyping(typing);

      if (otherTypingStaleTimeoutRef.current) {
        clearTimeout(otherTypingStaleTimeoutRef.current);
        otherTypingStaleTimeoutRef.current = null;
      }
      if (typing) {
        otherTypingStaleTimeoutRef.current = setTimeout(() => setOtherTyping(false), 6000);
      }
    }

    function subscribe() {
      channel = supabase
        .channel(`conversation-typing:${conversationId}`, {
          config: { presence: { key: userId } },
        })
        .on("presence", { event: "sync" }, () => {
          if (channel) syncTyping(channel);
        })
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            channelRef.current = channel;
            channel?.track({ typing: false });
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (channelRef.current === channel) channelRef.current = null;
            if (channel) {
              supabase.removeChannel(channel);
              channel = null;
            }
            retryTimeout = setTimeout(() => {
              retryTimeout = null;
              if (!cancelled) subscribe();
            }, 2000);
          }
        });
    }

    subscribe();

    return () => {
      cancelled = true;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (otherTypingStaleTimeoutRef.current) clearTimeout(otherTypingStaleTimeoutRef.current);
      channelRef.current = null;
      setOtherTyping(false);
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, userId, otherProfile.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Focus direct sur le champ de saisie quand on choisit de répondre à un
  // message — évite d'avoir à cliquer une seconde fois juste pour pouvoir
  // écrire.
  useEffect(() => {
    if (replyingTo) messageInputRef.current?.focus();
  }, [replyingTo]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || sending) return;

    setSending(true);
    setContent("");
    stopTyping();
    const replyToId = replyingTo?.id ?? null;
    setReplyingTo(null);
    try {
      const supabase = createClient();
      const sent = await sendMessage(supabase, conversationId, userId, text, replyToId);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
    } catch {
      const supabase = createClient();
      const blocked = await isBlockedBetween(supabase, userId, otherProfile.id).catch(
        () => false
      );
      if (blocked) {
        const byMe = await haveIBlocked(supabase, userId, otherProfile.id).catch(() => false);
        closeDueToBlock(byMe);
      } else {
        setContent(text);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border p-4">
        <Link
          href="/messages"
          className="text-lg font-semibold text-teal2 lg:hidden"
          aria-label={t("back")}
        >
          ←
        </Link>
        <Link
          href={`/profile/${otherProfile.id}`}
          className="flex min-w-0 flex-1 items-center gap-3"
        >
          <div className="relative shrink-0">
            <Avatar profile={otherProfile} size="sm" deletedUserLabel={tCommon("deletedUser")} />
            <OnlineDot
              userId={otherProfile.id}
              className="absolute bottom-0 right-0 h-2.5 w-2.5"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-text">{otherDisplayName}</p>
            {isOnline && (
              <p className="flex items-center gap-1 text-xs font-semibold text-teal2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                {t("onlineStatus")}
              </p>
            )}
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            title={t("searchInConversation")}
            aria-label={t("searchInConversation")}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ${
              searchOpen ? "bg-bg text-teal2" : "text-muted hover:bg-bg"
            }`}
          >
            🔍
          </button>
          <ReportButton
            reporterId={userId}
            targetType="profile"
            targetId={otherProfile.id}
            compact
          />
          <BlockButton
            blockerId={userId}
            blockedId={otherProfile.id}
            blockedName={otherDisplayName}
            compact
            onBlocked={() => closeDueToBlock(true)}
          />
        </div>
      </div>

      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-bg px-4 py-2">
          <input
            type="text"
            autoFocus
            value={searchQuery}
            onChange={(e) => handleSearchQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") goToMatch(e.shiftKey ? -1 : 1);
              if (e.key === "Escape") closeSearch();
            }}
            placeholder={t("searchInConversationPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-teal2"
          />
          <span className="shrink-0 text-xs text-muted">
            {searchQuery.trim()
              ? searchMatches.length > 0
                ? t("matchCount", { current: matchIndex + 1, total: searchMatches.length })
                : t("noMatchesInConversation")
              : ""}
          </span>
          <button
            type="button"
            onClick={() => goToMatch(-1)}
            disabled={searchMatches.length === 0}
            aria-label={t("previousMatch")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-card disabled:opacity-40"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => goToMatch(1)}
            disabled={searchMatches.length === 0}
            aria-label={t("nextMatch")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-card disabled:opacity-40"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={closeSearch}
            aria-label={t("closeSearch")}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-card"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted">{t("noMessagesYet")}</p>
        ) : (
          messages.map((message, i) => {
            const date = new Date(message.created_at);
            const prevDate =
              i > 0 ? new Date(messages[i - 1].created_at) : null;
            const showDivider = !prevDate || date.toDateString() !== prevDate.toDateString();

            const repliedTo = message.reply_to_id
              ? messagesById.get(message.reply_to_id)
              : null;

            return (
              <div
                key={message.id}
                ref={(el) => {
                  if (el) messageRefs.current.set(message.id, el);
                  else messageRefs.current.delete(message.id);
                }}
                className={`flex flex-col gap-3 rounded-xl transition-colors ${
                  highlightedId === message.id ? "bg-teal2/10" : ""
                }`}
              >
                {showDivider && (
                  <p className="text-center text-xs text-muted">
                    {dayDividerLabel(date, format, t)}
                  </p>
                )}
                <MessageBubble
                  message={message}
                  isMine={message.sender_id === userId}
                  time={format.dateTime(date, { hour: "2-digit", minute: "2-digit" })}
                  status={
                    message.sender_id === userId
                      ? message.read_at
                        ? "read"
                        : message.delivered_at
                          ? "delivered"
                          : "sent"
                      : undefined
                  }
                  statusLabel={
                    message.sender_id === userId
                      ? message.read_at
                        ? t("read")
                        : message.delivered_at
                          ? t("statusDelivered")
                          : t("statusSent")
                      : undefined
                  }
                  repliedMessage={
                    message.reply_to_id
                      ? {
                          isMine: repliedTo?.sender_id === userId,
                          senderName: otherDisplayName,
                          content: repliedTo && !repliedTo.removed_at ? repliedTo.content : null,
                        }
                      : null
                  }
                  reactions={reactionsByMessageId.get(message.id) ?? []}
                  myUserId={userId}
                  highlightQuery={searchQuery.trim() || undefined}
                  onReply={() => setReplyingTo(message)}
                  onToggleReaction={(emoji) => toggleReaction(message.id, emoji)}
                  onJumpToMessage={jumpToMessage}
                  onDelete={() => handleDeleteMessage(message.id)}
                  replyLabel={t("reply")}
                  deleteLabel={t("deleteMessage")}
                  youLabel={tCommon("you")}
                  removedLabel={t("messageRemovedPlaceholder")}
                />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <TypingIndicator
        label={typingLabel(otherTyping ? [otherDisplayName] : [], {
          one: (name) => t("typingOne", { name }),
          two: (a, b) => t("typingTwo", { a, b }),
          many: (count) => t("typingMany", { count }),
        })}
      />

      {replyingTo && (
        <ReplyPreviewBar
          senderLabel={t("replyingTo", {
            name: replyingTo.sender_id === userId ? tCommon("you") : otherDisplayName,
          })}
          content={replyingTo.content ?? t("messageRemovedPlaceholder")}
          onCancel={() => setReplyingTo(null)}
          cancelLabel={t("cancelReply")}
        />
      )}

      <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-4">
        <input
          ref={messageInputRef}
          type="text"
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          placeholder={t("messagePlaceholder")}
          className="min-w-0 flex-1 rounded-full border border-border px-4 py-2.5 text-sm outline-none focus:border-teal2"
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="rounded-full px-6 py-2.5 font-bold text-white disabled:opacity-60"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {t("send")}
        </button>
      </form>
    </div>
  );
}
