"use client";

import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { MapPin, Calendar, MessageCircle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateConversation } from "@/lib/messages/queries";
import {
  EventEndedError,
  EventFullError,
  deleteEvent,
  registerForEvent,
  unregisterFromEvent,
} from "@/lib/events/queries";
import type { EventRow, EventPhotoRow, EventMessageRow } from "@/lib/events/types";
import type { Interest, ProfileSummary } from "@/lib/profile/types";
import { PageHeader } from "@/components/layout/page-header";
import { MapView, type MapPoint } from "@/components/map/map-view";
import { EventChatPane } from "@/components/events/event-chat-pane";
import { PhotoLightbox } from "@/components/media/photo-lightbox";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

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
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();

  const [registered, setRegistered] = useState(initialIsRegistered);
  const [registrationCount, setRegistrationCount] = useState(initialRegistrationCount);
  const [pending, setPending] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmWord = t("deleteConfirmWord");
  const canDelete = confirmText.trim().toUpperCase() === confirmWord.toUpperCase();

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

  function closeConfirm() {
    if (deleting) return;
    setConfirmOpen(false);
    setConfirmText("");
    setDeleteError(false);
  }

  async function handleDelete() {
    setDeleteError(false);
    setDeleting(true);
    try {
      const supabase = createClient();
      await deleteEvent(supabase, event.id);
      router.push("/events");
      router.refresh();
    } catch {
      setDeleteError(true);
      setDeleting(false);
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
            categoryLabel: interestLabel,
            whenLabel: format.dateTime(new Date(event.starts_at), {
              dateStyle: "medium",
              timeStyle: "short",
            }),
            infoLine:
              event.capacity != null
                ? tDiscovery("spotsLimited", { count: registrationCount, capacity: event.capacity })
                : tDiscovery("spotsUnlimited", { count: registrationCount }),
            imageUrl: photos[0]?.url ?? null,
            href: `/events/${event.id}`,
          },
        ]
      : [];

  return (
    <div className="flex flex-col">
      <PageHeader title={event.title} onBack={() => router.back()} backLabel={tCommon("back")} />

      <div className="grid min-w-0 gap-6 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-10">
        <div className="flex min-w-0 flex-col gap-5">
          {photos.length > 0 && (
            <div className="flex min-w-0 gap-2 overflow-x-auto">
              {photos.map((photo, i) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="h-40 w-56 shrink-0 overflow-hidden rounded-2xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.url} alt="" className="h-full w-full object-cover" />
                </button>
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

            <div className="mt-4 flex flex-col gap-1.5 text-sm text-text">
              <p className="flex items-center gap-1.5 font-semibold">
                <Calendar className="h-4 w-4 shrink-0 text-teal2" strokeWidth={2} aria-hidden />
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
              <p className="flex items-center gap-1.5 text-muted">
                <MapPin className="h-4 w-4 shrink-0 text-teal2" strokeWidth={2} aria-hidden />
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
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-text transition-colors hover:border-teal2 hover:text-teal2 disabled:opacity-60"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={2} aria-hidden />
                {messaging ? t("messaging") : t("contactOrganizer")}
              </button>
            )}
          </div>

          {mapPoints.length > 0 && (
            <MapView points={mapPoints} height="16rem" className="overflow-hidden rounded-2xl border border-border" />
          )}
        </div>

        <div className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card">
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

      {isOrganizer && (
        <div className="mx-6 mb-10 rounded-2xl border border-border bg-card p-6 md:mx-10">
          <h2 className="mb-2 font-bold text-text">{t("deleteEventTitle")}</h2>
          <p className="mb-4 text-sm text-muted">{t("deleteEventBody")}</p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-full px-4 py-2.5 text-sm font-bold text-white"
            style={{ background: "#e55" }}
          >
            {t("deleteEventButton")}
          </button>
        </div>
      )}

      <Modal open={confirmOpen} onClose={closeConfirm} title={t("deleteEventTitle")}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("deleteEventWarning")}</p>
          <p className="text-sm text-text">{t("deleteConfirmPrompt", { word: confirmWord })}</p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
          />

          {deleteError && <Notice kind="error" message={t("deleteEventError")} />}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeConfirm}
              disabled={deleting}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#e55" }}
            >
              {deleting ? "…" : t("deleteEventConfirmButton")}
            </button>
          </div>
        </div>
      </Modal>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos.map((photo) => photo.url)}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          closeLabel={tCommon("lightboxClose")}
          prevLabel={tCommon("lightboxPrev")}
          nextLabel={tCommon("lightboxNext")}
        />
      )}
    </div>
  );
}
