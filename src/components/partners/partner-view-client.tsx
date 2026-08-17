"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, Phone, Globe } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import type { PartnerListingRow } from "@/lib/partners/queries";
import type { Interest } from "@/lib/profile/types";
import { PageHeader } from "@/components/layout/page-header";
import { MapView, type MapPoint } from "@/components/map/map-view";
import { PhotoLightbox } from "@/components/media/photo-lightbox";
import {
  OPENING_HOURS_DAYS,
  dayKeyForDate,
  hasAnyHours,
  isOpenNow,
  type OpeningHours,
} from "@/lib/partners/opening-hours";

export function PartnerViewClient({
  listing,
  interest,
  isOwn,
}: {
  listing: PartnerListingRow;
  interest: Interest | null;
  isOwn: boolean;
}) {
  const t = useTranslations("Partners.discovery");
  const tDays = useTranslations("Partners.days");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const hours = listing.opening_hours as OpeningHours | null;
  const openNow = isOpenNow(hours);
  const todayKey = dayKeyForDate();

  const interestLabel = interest
    ? `${interest.emoji ? `${interest.emoji} ` : ""}${
        locale === "en" ? interest.label_en : interest.label_fr
      }`
    : null;

  const mapPoints: MapPoint[] =
    listing.latitude != null && listing.longitude != null
      ? [
          {
            id: listing.id,
            kind: "partner",
            latitude: listing.latitude,
            longitude: listing.longitude,
            title: listing.name,
            categoryLabel: interestLabel,
            description: listing.tagline,
            imageUrl: listing.photo_urls[0] ?? null,
            href: `/partners/${listing.id}`,
            isOpenNow: openNow,
          },
        ]
      : [];

  return (
    <div className="flex flex-col">
      <PageHeader title={listing.name} onBack={() => router.back()} backLabel={tCommon("back")} />

      <div className="flex flex-col gap-5 p-6 md:p-10">
        {listing.photo_urls.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto">
            {listing.photo_urls.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="relative h-40 w-56 shrink-0 overflow-hidden rounded-2xl"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {i === 0 && listing.logo_url && (
                  <div className="absolute bottom-2 left-2 h-11 w-11 overflow-hidden rounded-lg border-2 border-white bg-white shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={listing.logo_url} alt="" className="h-full w-full object-contain" />
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          listing.logo_url && (
            <div className="h-16 w-16 overflow-hidden rounded-xl border border-border bg-card p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={listing.logo_url} alt="" className="h-full w-full object-contain" />
            </div>
          )
        )}

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-2">
            {interestLabel && (
              <span className="rounded-full border border-teal2 px-2.5 py-0.5 text-xs font-semibold text-teal2">
                {interestLabel}
              </span>
            )}
            {openNow !== null && (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-bold uppercase text-white"
                style={{ backgroundColor: openNow ? "var(--teal1)" : "#9aa5a3" }}
              >
                {openNow ? t("openNow") : t("closedNow")}
              </span>
            )}
            {isOwn && listing.status !== "active" && (
              <span className="rounded-full bg-black/50 px-2.5 py-0.5 text-xs font-bold uppercase text-white">
                {t("pendingBadge")}
              </span>
            )}
          </div>

          {listing.tagline && (
            <p className="mt-3 text-sm font-semibold text-teal2">{listing.tagline}</p>
          )}

          {listing.description && (
            <p className="mt-3 whitespace-pre-wrap text-sm text-text">{listing.description}</p>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="h-4 w-4 shrink-0 text-teal2" strokeWidth={2} aria-hidden />
            {listing.city}
            {listing.address ? ` — ${listing.address}` : ""}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {listing.phone && (
              <a
                href={`tel:${listing.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-text transition-colors hover:border-teal2 hover:text-teal2"
              >
                <Phone className="h-4 w-4" strokeWidth={2} aria-hidden />
                {t("contactPhone")}
              </a>
            )}
            {listing.website && (
              <a
                href={listing.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-semibold text-text transition-colors hover:border-teal2 hover:text-teal2"
              >
                <Globe className="h-4 w-4" strokeWidth={2} aria-hidden />
                {t("contactWebsite")}
              </a>
            )}
          </div>

          {isOwn && (
            <Link
              href={`/partners/${listing.id}/edit`}
              className="mt-4 inline-block text-sm font-semibold text-teal2 hover:underline"
            >
              {t("editLink")}
            </Link>
          )}
        </div>

        {hasAnyHours(hours) && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
              {t("hoursTitle")}
            </h3>
            <div className="flex flex-col gap-1.5 text-sm">
              {OPENING_HOURS_DAYS.map((day) => {
                const ranges = hours?.[day];
                const isToday = day === todayKey;
                return (
                  <div
                    key={day}
                    className={`flex items-center justify-between ${
                      isToday ? "font-extrabold text-text" : "text-muted"
                    }`}
                  >
                    <span>{tDays(day)}</span>
                    <span>
                      {ranges && ranges.length > 0
                        ? ranges.map((r) => `${r.open}–${r.close}`).join(", ")
                        : t("hoursClosed")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {mapPoints.length > 0 && (
          <MapView
            points={mapPoints}
            height="16rem"
            className="overflow-hidden rounded-2xl border border-border"
          />
        )}
      </div>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={listing.photo_urls}
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
