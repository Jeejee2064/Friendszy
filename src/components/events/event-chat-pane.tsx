"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { listEventMessages, sendEventMessage } from "@/lib/events/messages-queries";
import { removeEventMessage } from "@/lib/events/queries";
import type { EventMessageRow } from "@/lib/events/types";
import { getProfilesByIds } from "@/lib/profile/queries";
import type { ProfileSummary } from "@/lib/profile/types";
import { EventMessageBubble } from "@/components/events/event-message-bubble";

function dayDividerLabel(
  date: Date,
  format: ReturnType<typeof useFormatter>,
  t: ReturnType<typeof useTranslations<"Events">>
): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, now)) return t("today");
  if (sameDay(date, yesterday)) return t("yesterday");
  return format.dateTime(date, { day: "numeric", month: "long" });
}

export function EventChatPane({
  eventId,
  userId,
  isOrganizer,
  initialMessages,
  initialSenders,
}: {
  eventId: string;
  userId: string;
  isOrganizer: boolean;
  initialMessages: EventMessageRow[];
  initialSenders: ProfileSummary[];
}) {
  const t = useTranslations("Events");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const [messages, setMessages] = useState<EventMessageRow[]>(initialMessages);
  const [senderById, setSenderById] = useState<Map<string, ProfileSummary>>(
    () => new Map(initialSenders.map((p) => [p.id, p]))
  );
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
        const fresh = await listEventMessages(supabase, eventId);
        if (cancelled) return;
        setMessages(fresh);
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

    function subscribe() {
      channel = supabase
        .channel(`event-chat:${eventId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "event_messages",
            filter: `event_id=eq.${eventId}`,
          },
          async (payload) => {
            const newMessage = payload.new as EventMessageRow;
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
            table: "event_messages",
            filter: `event_id=eq.${eventId}`,
          },
          (payload) => {
            const updated = payload.new as EventMessageRow;
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          }
        )
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            catchUp();
            return;
          }

          // The socket dropped (network blip, background-tab throttling,
          // etc.) — without this, new/removed messages silently stop
          // arriving until the page is refreshed.
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
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, userId]);

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
      const sent = await sendEventMessage(supabase, eventId, userId, text);
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
      await removeEventMessage(supabase, messageId, userId);
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

            return (
              <div key={message.id} className="flex flex-col gap-3">
                {showDivider && (
                  <p className="text-center text-xs text-muted">
                    {dayDividerLabel(date, format, t)}
                  </p>
                )}
                <EventMessageBubble
                  message={message}
                  isMine={message.sender_id === userId}
                  sender={senderById.get(message.sender_id)}
                  time={format.dateTime(date, { hour: "2-digit", minute: "2-digit" })}
                  canRemove={isOrganizer}
                  onRemove={handleRemove}
                  removedLabel={t("messageRemovedPlaceholder")}
                  removeLabel={t("removeMessage")}
                  deletedUserLabel={tCommon("deletedUser")}
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
