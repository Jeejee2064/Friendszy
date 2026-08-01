"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { listPartnerListings, type PartnerListingRow } from "@/lib/partners/queries";
import type { Interest } from "@/lib/profile/types";
import { CityAutocomplete } from "@/components/search/city-autocomplete";
import { GroupInterestSelect } from "@/components/groups/group-interest-select";
import { ReportButton } from "@/components/social/report-button";

export function PartnersPageClient({
  userId,
  interests,
  initialListings,
}: {
  userId: string;
  interests: Interest[];
  initialListings: PartnerListingRow[];
}) {
  const t = useTranslations("Partners.discovery");
  const locale = useLocale();

  const [listings, setListings] = useState<PartnerListingRow[]>(initialListings);
  const [loading, setLoading] = useState(false);
  const [interestId, setInterestId] = useState<number | null>(null);
  const [city, setCity] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      const supabase = createClient();
      listPartnerListings(supabase, {
        interestId: interestId ?? undefined,
        city: city || undefined,
      })
        .then(setListings)
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [interestId, city]);

  function labelFor(interest: Interest) {
    return locale === "en" ? interest.label_en : interest.label_fr;
  }

  function interestFor(id: number) {
    return interests.find((i) => i.id === id);
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-text">{t("title")}</h1>
        <Link
          href="/partners/new"
          className="rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {t("createButton")}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-[220px] flex-1">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            {t("categoryLabel")}
          </p>
          <GroupInterestSelect
            interests={interests}
            value={interestId}
            onChange={setInterestId}
            allowClear
            collapsible
          />
        </div>
        <div className="min-w-[220px] flex-1">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            {t("cityLabel")}
          </p>
          <CityAutocomplete value={city} onChange={setCity} placeholder={t("cityPlaceholder")} />
        </div>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted">{t("loading")}</p>
      ) : listings.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("noResults")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => {
            const interest = interestFor(listing.interest_id);
            const isOwn = listing.profile_id === userId;
            return (
              <div
                key={listing.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
              >
                <div
                  className="h-36 w-full overflow-hidden"
                  style={
                    !listing.photo_urls[0] ? { backgroundImage: "var(--grad)" } : undefined
                  }
                >
                  {listing.photo_urls[0] && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={listing.photo_urls[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-bold text-text">{listing.name}</h2>
                    {isOwn && listing.status !== "active" && (
                      <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                        {t("pendingBadge")}
                      </span>
                    )}
                  </div>
                  {interest && (
                    <span className="text-xs text-muted">
                      {interest.emoji ? `${interest.emoji} ` : ""}
                      {labelFor(interest)}
                    </span>
                  )}
                  {listing.description && (
                    <p className="line-clamp-2 text-sm text-muted">{listing.description}</p>
                  )}
                  <p className="text-xs text-muted">
                    {listing.city}
                    {listing.address ? ` — ${listing.address}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs">
                    {listing.phone && (
                      <a href={`tel:${listing.phone}`} className="font-semibold text-teal2">
                        {t("contactPhone")}
                      </a>
                    )}
                    {listing.website && (
                      <a
                        href={listing.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-teal2"
                      >
                        {t("contactWebsite")}
                      </a>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-2">
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
          })}
        </div>
      )}
    </div>
  );
}
