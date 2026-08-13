"use client";

import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateConversation } from "@/lib/messages/queries";
import {
  EventEndedError,
  EventFullError,
  registerForEvent,
  unregisterFromEvent,
} from "@/lib/events/queries";
import type { EventRow, EventPhotoRow, EventMessageRow } from "@/lib/events/types";
import type { Interest, ProfileSummary } from "@/lib/profile/types";
import { PageHeader } from "@/components/layout/page-header";
import { ReportButton } from "@/components/social/report-button";
import { MapView, type MapPoint } from "@/components/map/map-view";
import { EventChatPane } from "@/components/events/event-chat-pane";

export function EventViewClient({
  userId,
  event,
  interest,
  organizer,
  registrationCount: initialRegistrationCount,
  isRegistered: initialIsRegistered,
  isOrganizer,
  photos,
  initialMessages,
  initialSenders,
}: {
  userId: string;
  event: EventRow;
  interest: Interest | null;
  organizer: ProfileSummary | null;
  registrationCount: number;
  isRegistered: boolean;
  isOrganizer: boolean;
  photos: EventPhotoRow[];
  initialMessages: EventMessageRow[];
  initialSenders: ProfileSummary[];
}) {
  const t = useTranslations("Events.detail");
  const tDiscovery = useTranslations("Events.discovery");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();

  const [registered, setRegistered] = useState(initialIsRegistered);
  const [registrationCount, setRegistrationCount] = useState(initialRegistrationCount);
  const [pending, setPending] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasEnded = new Date(event.ends_at) < new Date();
  const isFull = event.capacity != null && registrationCount >= event.capacity;
  const interestLabel = interest
    ? `${interest.emoji ? `${interest.emoji} ` : ""}${
        locale === "en" ? interest.label_en : interest.label_fr
      }`
    : null;
  const organizerName = organizer?.full_name
    ? [organizer.full_name, organizer.last_name].filter(Boolean).join(" ")
    : null;

  async function handleRegister() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      await registerForEvent(supabase, event.id, userId);
      setRegistered(true);
      setRegistrationCount((c) => c + 1);
    } catch (err) {
      if (err instanceof EventFullError) setError(t("errors.fullError"));
      else if (err instanceof EventEndedError) setError(t("errors.endedError"));
      else setError(t("errors.registerFailed"));
    } finally {
      setPending(false);
    }
  }

  async function handleUnregister() {
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      await unregisterFromEvent(supabase, event.id, userId);
      setRegistered(false);
      setRegistrationCount((c) => Math.max(0, c - 1));
    } catch {
      setError(t("errors.registerFailed"));
    } finally {
      setPending(false);
    }
  }

  async function handleContactOrganizer() {
    if (!organizer) return;
    setMessaging(true);
    try {
      const supabase = createClient();
      const conversationId = await getOrCreateConversation(supabase, userId, organizer.id);
      router.push(`/messages?c=${conversationId}`);
    } finally {
      setMessaging(false);
    }
  }

  const mapPoints: MapPoint[] =
    event.latitude != null && event.longitude != null
      ? [
          {
            id: event.id,
            kind: "event",
            latitude: event.latitude,
            longitude: event.longitude,
            title: event.title,
            subtitle: event.city,
            imageUrl: photos[0]?.url ?? null,
            href: `/events/${event.id}`,
          },
        ]
      : [];

  return (
    <div className="flex flex-col">
      <PageHeader
        title={event.title}
        actions={<ReportButton reporterId={userId} targetType="event" targetId={event.id} />}
      />

      <div className="grid gap-6 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-10">
        <div className="flex flex-col gap-5">
          {photos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photo.id}
                  src={photo.url}
                  alt=""
                  className="h-40 w-56 shrink-0 rounded-2xl object-cover"
                />
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center gap-2">
              {interestLabel && (
                <span className="rounded-full border border-teal2 px-2.5 py-0.5 text-xs font-semibold text-teal2">
                  {interestLabel}
                </span>
              )}
              {isFull && !hasEnded && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold uppercase text-white"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {tDiscovery("full")}
                </span>
              )}
            </div>

            {event.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-text">{event.description}</p>
            )}

            <div className="mt-4 flex flex-col gap-1 text-sm text-text">
              <p className="font-semibold">
                {format.dateTime(new Date(event.starts_at), {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
                {" → "}
                {format.dateTime(new Date(event.ends_at), {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </p>
              <p className="text-muted">
                {event.city}
                {event.address ? ` — ${event.address}` : ""}
              </p>
              <p className="text-muted">
                {event.capacity != null
                  ? tDiscovery("spotsLimited", { count: registrationCount, capacity: event.capacity })
                  : tDiscovery("spotsUnlimited", { count: registrationCount })}
              </p>
              {organizerName ? (
                <p className="text-muted">{t("organizerLabel", { name: organizerName })}</p>
              ) : (
                <p className="text-muted">{t("deletedOrganizer")}</p>
              )}
            </div>

            {hasEnded ? (
              <p className="mt-4 text-sm text-muted">{t("endedNotice")}</p>
            ) : registered ? (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-sm font-semibold text-teal2">{t("registeredNotice")}</p>
                <button
                  type="button"
                  onClick={handleUnregister}
                  disabled={pending}
                  className="rounded-full border border-border px-4 py-2 text-sm font-bold text-muted disabled:opacity-60"
                >
                  {pending ? t("registering") : t("unregisterButton")}
                </button>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-2">
                {isFull && <p className="text-sm text-muted">{t("fullNotice")}</p>}
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={pending || isFull}
                  className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {pending ? t("registering") : t("registerButton")}
                </button>
              </div>
            )}

            {error && (
              <div
                className="mt-3 rounded-lg border p-3 text-sm"
                style={{ background: "#fdecec", borderColor: "#f3c8c8", color: "#e55" }}
              >
                {error}
              </div>
            )}

            {organizer && organizer.id !== userId && organizerName && (
              <button
                type="button"
                onClick={handleContactOrganizer}
                disabled={messaging}
                className="mt-3 text-sm font-semibold text-teal2 hover:underline disabled:opacity-60"
              >
                {messaging ? t("messaging") : t("contactOrganizer")}
              </button>
            )}
          </div>

          {mapPoints.length > 0 && (
            <MapView points={mapPoints} height="16rem" className="overflow-hidden rounded-2xl border border-border" />
          )}
        </div>

        <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <p className="font-bold text-text">{t("chatTitle")}</p>
          </div>
          {registered ? (
            <EventChatPane
              eventId={event.id}
              userId={userId}
              isOrganizer={isOrganizer}
              initialMessages={initialMessages}
              initialSenders={initialSenders}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <p className="text-sm text-muted">{t("chatLockedNotice")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
