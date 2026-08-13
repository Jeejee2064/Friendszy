"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PartnerListingRow } from "@/lib/partners/queries";
import type { Interest } from "@/lib/profile/types";
import { ReportButton } from "@/components/social/report-button";

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

  function labelFor(i: Interest) {
    return locale === "en" ? i.label_en : i.label_fr;
  }

  return (
    <div
      id={`partner-${listing.id}`}
      className="flex scroll-mt-24 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-200 hover:shadow-lg"
    >
      <div
        className="relative h-40 w-full overflow-hidden"
        style={!listing.photo_urls[0] ? { backgroundColor: "var(--blue)" } : undefined}
      >
        {listing.photo_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.photo_urls[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">📍</div>
        )}
        {isOwn && listing.status !== "active" && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase text-white backdrop-blur-sm">
            {t("pendingBadge")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="text-[15px] font-extrabold leading-tight text-text">{listing.name}</h2>
        {interest && (
          <span className="w-fit rounded-full border border-blue px-2.5 py-0.5 text-xs font-semibold text-blue">
            {interest.emoji ? `${interest.emoji} ` : ""}
            {labelFor(interest)}
          </span>
        )}
        {listing.description && (
          <p className="line-clamp-2 text-sm text-muted">{listing.description}</p>
        )}
        <p className="text-xs text-muted">
          <span aria-hidden>📍 </span>
          {listing.city}
          {listing.address ? ` — ${listing.address}` : ""}
        </p>
        <div className="mt-1 flex flex-wrap gap-3 text-xs">
          {listing.phone && (
            <a href={`tel:${listing.phone}`} className="font-semibold text-teal2 hover:underline">
              {t("contactPhone")}
            </a>
          )}
          {listing.website && (
            <a
              href={listing.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-teal2 hover:underline"
            >
              {t("contactWebsite")}
            </a>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-2.5">
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
