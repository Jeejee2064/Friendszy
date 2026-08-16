"use client";

import { useLocale, useTranslations } from "next-intl";
import { MapPin, Phone, Globe } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { PartnerListingRow } from "@/lib/partners/queries";
import type { Interest } from "@/lib/profile/types";
import { ReportButton } from "@/components/social/report-button";
import { isOpenNow, type OpeningHours } from "@/lib/partners/opening-hours";

export function PartnerCard({
  listing,
  interests,
  userId,
}: {
  listing: PartnerListingRow;
  interests: Interest[];
  userId: string;
}) {
  const t = useTranslations("Partners.discovery");
  const locale = useLocale();

  const interest = interests.find((i) => i.id === listing.interest_id);
  const isOwn = listing.profile_id === userId;
  const openNow = isOpenNow(listing.opening_hours as OpeningHours | null);

  function labelFor(i: Interest) {
    return locale === "en" ? i.label_en : i.label_fr;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-lg">
      {/* Only the "what is this" part of the card links to the detail page
          — phone/website/edit/report below stay outside it, as their own
          links/button, since a Link renders an <a> and nesting more <a>s
          (or a <button> that needs its own click) inside it is invalid
          HTML with unreliable click behavior. */}
      <Link href={`/partners/${listing.id}`} className="group flex flex-1 flex-col">
        <div
          className="relative h-40 w-full overflow-hidden"
          style={!listing.photo_urls[0] ? { backgroundColor: "var(--blue)" } : undefined}
        >
          {listing.photo_urls[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photo_urls[0]}
              alt=""
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MapPin className="h-9 w-9 text-white" strokeWidth={1.75} aria-hidden />
            </div>
          )}
          {isOwn && listing.status !== "active" && (
            <span className="absolute right-2.5 top-2.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase text-white backdrop-blur-sm">
              {t("pendingBadge")}
            </span>
          )}
          {openNow !== null && (
            <span
              className="absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase text-white backdrop-blur-sm"
              style={{ backgroundColor: openNow ? "rgba(30,207,176,0.9)" : "rgba(0,0,0,0.5)" }}
            >
              {openNow ? t("openNow") : t("closedNow")}
            </span>
          )}
          {listing.logo_url && (
            <div className="absolute bottom-2 left-2 h-9 w-9 overflow-hidden rounded-lg border-2 border-white bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={listing.logo_url} alt="" className="h-full w-full object-contain" />
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4 pb-0">
          <h2 className="text-[15px] font-extrabold leading-tight text-text group-hover:text-teal2">
            {listing.name}
          </h2>
          {listing.tagline && (
            <p className="line-clamp-1 text-xs font-semibold text-teal2">{listing.tagline}</p>
          )}
          {interest && (
            <span className="w-fit rounded-full border border-blue px-2.5 py-0.5 text-xs font-semibold text-blue">
              {interest.emoji ? `${interest.emoji} ` : ""}
              {labelFor(interest)}
            </span>
          )}
          {listing.description && (
            <p className="line-clamp-2 text-sm text-muted">{listing.description}</p>
          )}
          <p className="flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-teal2" strokeWidth={2} aria-hidden />
            {listing.city}
            {listing.address ? ` — ${listing.address}` : ""}
          </p>
        </div>
      </Link>
      <div className="flex flex-col gap-2 p-4 pt-1">
        <div className="flex flex-wrap gap-3 text-xs">
          {listing.phone && (
            <a
              href={`tel:${listing.phone}`}
              className="inline-flex items-center gap-1 font-semibold text-teal2 hover:underline"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {t("contactPhone")}
            </a>
          )}
          {listing.website && (
            <a
              href={listing.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-teal2 hover:underline"
            >
              <Globe className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              {t("contactWebsite")}
            </a>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-2.5">
          {isOwn ? (
            <Link
              href={`/partners/${listing.id}/edit`}
              className="text-xs font-semibold text-teal2 hover:underline"
            >
              {t("editLink")}
            </Link>
          ) : (
            <span />
          )}
          <ReportButton
            reporterId={userId}
            targetType="partner_listing"
            targetId={listing.id}
            compact
          />
        </div>
      </div>
    </div>
  );
}
