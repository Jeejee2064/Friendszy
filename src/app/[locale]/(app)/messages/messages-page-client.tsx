"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  sendMessage,
  markConversationRead,
  getOrCreateConversation,
  type MessageRow,
} from "@/lib/messages/queries";
import { listFriends } from "@/lib/friends/queries";
import { isBlockedBetween, haveIBlocked } from "@/lib/blocks/queries";
import type { ProfileSummary } from "@/lib/profile/types";
import { MessageBubble } from "@/components/messages/message-bubble";
import { OnlineDot } from "@/components/social/online-dot";
import { BlockButton } from "@/components/social/block-button";
import { ReportButton } from "@/components/social/report-button";
import { PageHeader } from "@/components/layout/page-header";
import { Modal } from "@/components/ui/modal";
import { usePresence } from "@/lib/presence/presence-context";
import { useToast } from "@/components/ui/toast-context";

type ConversationSummary = {
  id: string;
  otherProfile: ProfileSummary;
  preview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

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
  conversations,
  selectedConversationId,
  selectedOtherProfile,
  initialMessages,
}: {
  userId: string;
  conversations: ConversationSummary[];
  selectedConversationId: string | null;
  selectedOtherProfile: ProfileSummary | null;
  initialMessages: MessageRow[];
}) {
  const t = useTranslations("Messages");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const now = useNow({ updateInterval: 60000 });
  const hasSelection = !!selectedConversationId && !!selectedOtherProfile;
  const [search, setSearch] = useState("");
  const [newConversationOpen, setNewConversationOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((c) =>
      (c.otherProfile.full_name ?? tCommon("deletedUser")).toLowerCase().includes(query)
    );
  }, [conversations, search, tCommon]);

  const unreadConversations = filtered.filter((c) => c.unreadCount > 0);
  const readConversations = filtered.filter((c) => c.unreadCount === 0);
  const totalUnread = unreadConversations.length;

  function renderConversationRow(c: ConversationSummary) {
    const name = c.otherProfile.full_name ?? tCommon("deletedUser");
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
      (f.full_name ?? tCommon("deletedUser")).toLowerCase().includes(query)
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
          <p className="p-4 text-center text-sm text-muted">{tFriends("noFriends")}</p>
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
                {friend.full_name ?? tCommon("deletedUser")}
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
}: {
  conversationId: string;
  userId: string;
  otherProfile: ProfileSummary;
  initialMessages: MessageRow[];
}) {
  const t = useTranslations("Messages");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const router = useRouter();
  const showToast = useToast();
  const onlineIds = usePresence();
  const isOnline = onlineIds.has(otherProfile.id);
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const closingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const displayName = otherProfile.full_name ?? tCommon("deletedUser");

  async function closeDueToBlock(byMe: boolean) {
    if (closingRef.current) return;
    closingRef.current = true;
    showToast({
      message: byMe
        ? t("blockedByYou", { name: displayName })
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

  useEffect(() => {
    const supabase = createClient();

    markConversationRead(supabase, conversationId, userId).catch(() => {});

    const channel = supabase
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
            markConversationRead(supabase, conversationId, userId).catch(() => {});
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text || sending) return;

    setSending(true);
    setContent("");
    try {
      const supabase = createClient();
      const sent = await sendMessage(supabase, conversationId, userId, text);
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

  const lastMineIndex = messages.map((m) => m.sender_id).lastIndexOf(userId);

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
            <p className="truncate font-bold text-text">{displayName}</p>
            {isOnline && (
              <p className="flex items-center gap-1 text-xs font-semibold text-teal2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                {t("onlineStatus")}
              </p>
            )}
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <ReportButton
            reporterId={userId}
            targetType="profile"
            targetId={otherProfile.id}
            compact
          />
          <BlockButton
            blockerId={userId}
            blockedId={otherProfile.id}
            blockedName={displayName}
            compact
            onBlocked={() => closeDueToBlock(true)}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted">{t("noMessagesYet")}</p>
        ) : (
          messages.map((message, i) => {
            const date = new Date(message.created_at);
            const prevDate =
              i > 0 ? new Date(messages[i - 1].created_at) : null;
            const showDivider = !prevDate || date.toDateString() !== prevDate.toDateString();

            return (
              <div key={message.id} className="flex flex-col gap-3">
                {showDivider && (
                  <p className="text-center text-xs text-muted">
                    {dayDividerLabel(date, format, t)}
                  </p>
                )}
                <MessageBubble
                  message={message}
                  isMine={message.sender_id === userId}
                  reporterId={userId}
                  readLabel={
                    message.sender_id === userId && i === lastMineIndex && message.read_at
                      ? t("read")
                      : undefined
                  }
                />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-4">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
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
