"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { EventCardData } from "@/lib/events/types";

export function EventCard({ event }: { event: EventCardData }) {
  const t = useTranslations("Events.discovery");
  const locale = useLocale();
  const format = useFormatter();

  const interestLabel = event.interest
    ? `${event.interest.emoji ? `${event.interest.emoji} ` : ""}${
        locale === "en" ? event.interest.label_en : event.interest.label_fr
      }`
    : null;

  const isFull = event.capacity != null && event.registrationCount >= event.capacity;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div
        className="relative h-40 w-full overflow-hidden"
        style={!event.coverPhotoUrl ? { backgroundImage: "var(--grad)" } : undefined}
      >
        {event.coverPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverPhotoUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">📅</div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
          {format.dateTime(new Date(event.starts_at), { dateStyle: "medium", timeStyle: "short" })}
        </span>
        {isFull && (
          <span
            className="absolute right-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white shadow-sm"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {t("full")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-[15px] font-extrabold leading-tight text-text group-hover:text-teal2">
          {event.title}
        </h2>
        {interestLabel && (
          <span className="w-fit rounded-full border border-teal2 px-2.5 py-0.5 text-xs font-semibold text-teal2">
            {interestLabel}
          </span>
        )}
        <p className="text-xs text-muted">
          <span aria-hidden>📍 </span>
          {event.city}
          {event.address ? ` — ${event.address}` : ""}
        </p>
        <p className="mt-auto pt-1 text-xs font-semibold text-muted">
          {event.capacity != null
            ? t("spotsLimited", { count: event.registrationCount, capacity: event.capacity })
            : t("spotsUnlimited", { count: event.registrationCount })}
        </p>
      </div>
    </Link>
  );
}
