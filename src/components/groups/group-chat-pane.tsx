"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useFormatter, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  listGroupMessages,
  sendGroupMessage,
  listGroupMessageReactions,
  setGroupMessageReaction,
  removeGroupMessageReaction,
} from "@/lib/groups/messages-queries";
import { removeGroupMessage } from "@/lib/groups/queries";
import type { GroupMessageRow, GroupMessageReactionRow } from "@/lib/groups/types";
import { getProfilesByIds } from "@/lib/profile/queries";
import type { ProfileSummary } from "@/lib/profile/types";
import { GroupMessageBubble } from "@/components/groups/group-message-bubble";
import { ReplyPreviewBar } from "@/components/chat/reply-preview-bar";
import { TypingIndicator } from "@/components/chat/typing-indicator";
import { typingLabel } from "@/lib/chat/typing-label";

function dayDividerLabel(
  date: Date,
  format: ReturnType<typeof useFormatter>,
  t: ReturnType<typeof useTranslations<"Groups">>
): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, now)) return t("today");
  if (sameDay(date, yesterday)) return t("yesterday");
  return format.dateTime(date, { day: "numeric", month: "long" });
}

export function GroupChatPane({
  groupId,
  userId,
  isAdmin,
  initialMessages,
  initialSenders,
  initialReactions,
}: {
  groupId: string;
  userId: string;
  isAdmin: boolean;
  initialMessages: GroupMessageRow[];
  initialSenders: ProfileSummary[];
  initialReactions: GroupMessageReactionRow[];
}) {
  const t = useTranslations("Groups");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const [messages, setMessages] = useState<GroupMessageRow[]>(initialMessages);
  const [senderById, setSenderById] = useState<Map<string, ProfileSummary>>(
    () => new Map(initialSenders.map((p) => [p.id, p]))
  );
  const [reactions, setReactions] = useState<GroupMessageReactionRow[]>(initialReactions);
  const [replyingTo, setReplyingTo] = useState<GroupMessageRow | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const messagesById = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const reactionsByMessageId = useMemo(() => {
    const map = new Map<string, GroupMessageReactionRow[]>();
    for (const r of reactions) {
      const list = map.get(r.message_id);
      if (list) list.push(r);
      else map.set(r.message_id, [r]);
    }
    return map;
  }, [reactions]);

  function nameFor(profileId: string): string {
    const profile = senderById.get(profileId);
    return profile?.full_name
      ? [profile.full_name, profile.last_name].filter(Boolean).join(" ")
      : tCommon("deletedUser");
  }

  function jumpToMessage(messageId: string) {
    messageRefs.current.get(messageId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(messageId);
    setTimeout(() => setHighlightedId((prev) => (prev === messageId ? null : prev)), 1500);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const mine = reactionsByMessageId.get(messageId)?.find((r) => r.user_id === userId);
    const supabase = createClient();
    try {
      if (mine?.emoji === emoji) {
        await removeGroupMessageReaction(supabase, messageId, userId);
        setReactions((prev) =>
          prev.filter((r) => !(r.message_id === messageId && r.user_id === userId))
        );
      } else {
        const saved = await setGroupMessageReaction(supabase, messageId, userId, emoji);
        setReactions((prev) => [
          ...prev.filter((r) => !(r.message_id === messageId && r.user_id === userId)),
          saved,
        ]);
      }
    } catch {
      // ignore — the realtime event (or next catchUp) reconciles the true state
    }
  }

  // Debounced typing broadcast via presence on the group channel (see
  // channelRef, set by the subscribe effect below) — presence untracks
  // automatically on disconnect, so a torn-down tab never leaves a stuck
  // "typing..." for everyone else.
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

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    // Re-pulls the full message list — used to catch up after (re)connecting,
    // since events missed while the channel was down (dropped socket,
    // backgrounded tab, ...) are otherwise lost for good.
    async function catchUp() {
      try {
        const [fresh, freshReactions] = await Promise.all([
          listGroupMessages(supabase, groupId),
          listGroupMessageReactions(supabase, groupId),
        ]);
        if (cancelled) return;
        setMessages(fresh);
        setReactions(freshReactions);
        const unseen = [...new Set(fresh.map((m) => m.sender_id))].filter(
          (id) => !senderById.has(id)
        );
        if (unseen.length > 0) {
          const profiles = await getProfilesByIds(supabase, unseen);
          if (!cancelled) {
            setSenderById((prev) => {
              const next = new Map(prev);
              for (const profile of profiles) next.set(profile.id, profile);
              return next;
            });
          }
        }
      } catch {
        // ignore transient errors, next reconnect/visibility change retries
      }
    }

    // Reads who's currently tracked as typing (excluding myself) from
    // presence state, and lazily fetches profiles for anyone not already
    // known from a prior message (someone can be typing without having
    // sent a single message yet).
    function syncTyping(current: RealtimeChannel) {
      const state = current.presenceState<{ typing?: boolean }>();
      const ids = Object.keys(state).filter(
        (id) => id !== userId && (state[id] ?? []).some((entry) => entry.typing)
      );
      setTypingUserIds(ids);
      const unseen = ids.filter((id) => !senderById.has(id));
      if (unseen.length > 0) {
        getProfilesByIds(supabase, unseen).then((profiles) => {
          if (cancelled) return;
          setSenderById((prev) => {
            const next = new Map(prev);
            for (const profile of profiles) next.set(profile.id, profile);
            return next;
          });
        });
      }
    }

    function subscribe() {
      channel = supabase
        .channel(`group-chat:${groupId}`, { config: { presence: { key: userId } } })
        .on("presence", { event: "sync" }, () => {
          if (channel) syncTyping(channel);
        })
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "group_messages",
            filter: `group_id=eq.${groupId}`,
          },
          async (payload) => {
            const newMessage = payload.new as GroupMessageRow;
            setMessages((prev) =>
              prev.some((m) => m.id === newMessage.id) ? prev : [...prev, newMessage]
            );
            if (!senderById.has(newMessage.sender_id)) {
              const profiles = await getProfilesByIds(supabase, [newMessage.sender_id]);
              if (!cancelled && profiles[0]) {
                setSenderById((prev) => new Map(prev).set(profiles[0].id, profiles[0]));
              }
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "group_messages",
            filter: `group_id=eq.${groupId}`,
          },
          (payload) => {
            const updated = payload.new as GroupMessageRow;
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "group_message_reactions",
            filter: `group_id=eq.${groupId}`,
          },
          (payload) => {
            const row = payload.new as GroupMessageReactionRow;
            setReactions((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "group_message_reactions",
            filter: `group_id=eq.${groupId}`,
          },
          (payload) => {
            const row = payload.new as GroupMessageReactionRow;
            setReactions((prev) => prev.map((r) => (r.id === row.id ? row : r)));
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "group_message_reactions",
            filter: `group_id=eq.${groupId}`,
          },
          (payload) => {
            const oldRow = payload.old as { id: string };
            setReactions((prev) => prev.filter((r) => r.id !== oldRow.id));
          }
        )
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            channelRef.current = channel;
            channel?.track({ typing: false });
            catchUp();
            return;
          }

          // The socket dropped (network blip, background-tab throttling,
          // etc.) — without this, new/removed messages silently stop
          // arriving until the page is refreshed.
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
      if (retryTimeout) clearTimeout(retryTimeout);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      channelRef.current = null;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
      const sent = await sendGroupMessage(supabase, groupId, userId, text, replyToId);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
    } catch {
      setContent(text);
    } finally {
      setSending(false);
    }
  }

  async function handleRemove(messageId: string) {
    const supabase = createClient();
    try {
      await removeGroupMessage(supabase, messageId, userId);
    } catch {
      // ignore — the realtime UPDATE (or next catchUp) will reflect the true state
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted">{t("noMessagesYet")}</p>
        ) : (
          messages.map((message, i) => {
            const date = new Date(message.created_at);
            const prevDate = i > 0 ? new Date(messages[i - 1].created_at) : null;
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
                <GroupMessageBubble
                  message={message}
                  isMine={message.sender_id === userId}
                  sender={senderById.get(message.sender_id)}
                  time={format.dateTime(date, { hour: "2-digit", minute: "2-digit" })}
                  canRemove={isAdmin}
                  onRemove={handleRemove}
                  removedLabel={t("messageRemovedPlaceholder")}
                  removeLabel={t("removeMessage")}
                  deletedUserLabel={tCommon("deletedUser")}
                  repliedMessage={
                    message.reply_to_id
                      ? {
                          isMine: repliedTo?.sender_id === userId,
                          senderName: repliedTo ? nameFor(repliedTo.sender_id) : tCommon("deletedUser"),
                          content:
                            repliedTo && !repliedTo.removed_at ? repliedTo.content : null,
                        }
                      : null
                  }
                  reactions={reactionsByMessageId.get(message.id) ?? []}
                  myUserId={userId}
                  onReply={() => setReplyingTo(message)}
                  onToggleReaction={(emoji) => toggleReaction(message.id, emoji)}
                  onJumpToMessage={jumpToMessage}
                  onDelete={() => handleRemove(message.id)}
                  replyLabel={t("reply")}
                  deleteLabel={t("deleteMessage")}
                  youLabel={tCommon("you")}
                />
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <TypingIndicator
        label={typingLabel(
          typingUserIds.map((id) => nameFor(id)),
          {
            one: (name) => t("typingOne", { name }),
            two: (a, b) => t("typingTwo", { a, b }),
            many: (count) => t("typingMany", { count }),
          }
        )}
      />

      {replyingTo && (
        <ReplyPreviewBar
          senderLabel={t("replyingTo", {
            name: replyingTo.sender_id === userId ? tCommon("you") : nameFor(replyingTo.sender_id),
          })}
          content={replyingTo.content ?? t("messageRemovedPlaceholder")}
          onCancel={() => setReplyingTo(null)}
          cancelLabel={t("cancelReply")}
        />
      )}

      <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-4">
        <input
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
