"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  listAllPartnerListingsForAdmin,
  setPartnerListingActive,
  type PartnerListingRow,
} from "@/lib/partners/queries";
import { logAdminAction } from "@/lib/admin/queries";
import { getProfilesByIds } from "@/lib/profile/queries";
import type { Interest, ProfileSummary } from "@/lib/profile/types";
import { Notice } from "@/components/ui/notice";
import { Modal } from "@/components/ui/modal";

const PAGE_SIZE = 10;

export function AdminPartnersClient({
  adminId,
  interests,
  initialListings,
}: {
  adminId: string;
  interests: Interest[];
  initialListings: PartnerListingRow[];
}) {
  const t = useTranslations("Admin.partners");
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [listings, setListings] = useState<PartnerListingRow[]>(initialListings);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  const [submitters, setSubmitters] = useState<Map<string, ProfileSummary>>(new Map());
  const [detailListingId, setDetailListingId] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      const supabase = createClient();
      listAllPartnerListingsForAdmin(supabase)
        .then(setListings)
        .finally(() => setLoading(false));
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const ids = [...new Set(listings.map((l) => l.profile_id).filter((id): id is string => !!id))];
    getProfilesByIds(supabase, ids).then((profiles) => {
      setSubmitters(new Map(profiles.map((p) => [p.id, p])));
    });
  }, [listings]);

  function submitterName(profileId: string | null): string {
    if (!profileId) return "—";
    const profile = submitters.get(profileId);
    if (!profile) return tCommon("deletedUser");
    return profile.full_name
      ? [profile.full_name, profile.last_name].filter(Boolean).join(" ")
      : tCommon("deletedUser");
  }

  function interestFor(id: number) {
    return interests.find((i) => i.id === id);
  }

  function labelFor(interest: Interest) {
    return locale === "en" ? interest.label_en : interest.label_fr;
  }

  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (search.trim() && !l.name.toLowerCase().includes(search.trim().toLowerCase()))
        return false;
      if (city.trim() && !l.city.toLowerCase().includes(city.trim().toLowerCase())) return false;
      if (status !== "all" && l.status !== status) return false;
      return true;
    });
  }, [listings, search, city, status]);

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / PAGE_SIZE));
  const pageListings = filteredListings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const detailListing = listings.find((l) => l.id === detailListingId) ?? null;
  const detailInterest = detailListing ? interestFor(detailListing.interest_id) : undefined;

  async function handleToggleActive(listing: PartnerListingRow) {
    setFeedback(null);
    try {
      const supabase = createClient();
      const nextActive = listing.status !== "active";
      await setPartnerListingActive(supabase, listing.id, nextActive);
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id ? { ...l, status: nextActive ? "active" : "inactive" } : l
        )
      );
      logAdminAction(supabase, {
        adminId,
        actionType: nextActive ? "activate" : "deactivate",
        targetType: "partner_listing",
        targetId: listing.id,
      }).catch(() => {});
      setFeedback("success");
      // Activating/deactivating changes the pending-listings count the
      // sidebar badge shows — refresh so it updates without a full navigation.
      router.refresh();
    } catch {
      setFeedback("error");
    }
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      {feedback && (
        <Notice
          kind={feedback}
          message={feedback === "success" ? tAdmin("actionSuccess") : tAdmin("actionError")}
          className="mb-4 max-w-md"
        />
      )}

      <div className="mb-4 flex flex-wrap gap-4 rounded-2xl border border-border bg-card p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="min-w-[200px] flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
        />
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={t("cityLabel")}
          className="min-w-[160px] rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
        />
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("statusLabel")}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="all">{t("statusAll")}</option>
            <option value="active">{t("statusActive")}</option>
            <option value="inactive">{t("statusInactive")}</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted">{tAdmin("loading")}</p>
      ) : pageListings.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("noListings")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pageListings.map((listing) => {
            const interest = interestFor(listing.interest_id);
            return (
              <div
                key={listing.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
              >
                <button
                  type="button"
                  onClick={() => setDetailListingId(listing.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-bold text-text hover:underline">
                    {listing.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {listing.city}
                    {interest ? ` · ${interest.emoji ? `${interest.emoji} ` : ""}${labelFor(interest)}` : ""}
                  </p>
                </button>
                <span className="text-xs font-semibold text-muted">
                  {t(`statusBadge.${listing.status}`)}
                </span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailListingId(listing.id)}
                    className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-text"
                  >
                    {tAdmin("viewAction")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(listing)}
                    className="rounded-full px-3 py-2 text-xs font-bold text-white"
                    style={{
                      background: listing.status === "active" ? "#e55" : "var(--teal2)",
                    }}
                  >
                    {t(listing.status === "active" ? "actions.deactivate" : "actions.activate")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredListings.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text disabled:opacity-40"
          >
            {tAdmin("pagination.prev")}
          </button>
          <span className="text-sm text-muted">
            {tAdmin("pagination.pageOf", { page, total: totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text disabled:opacity-40"
          >
            {tAdmin("pagination.next")}
          </button>
        </div>
      )}

      <Modal
        open={!!detailListing}
        onClose={() => setDetailListingId(null)}
        title={detailListing ? t("detailTitle") : undefined}
      >
        {detailListing && (
          <div className="flex flex-col gap-4">
            {detailListing.photo_urls.length > 0 && (
              <div className="-mx-6 flex gap-2 overflow-x-auto px-6">
                {detailListing.photo_urls.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt=""
                    className="h-24 w-24 shrink-0 rounded-xl object-cover"
                  />
                ))}
              </div>
            )}

            <div className="flex items-start gap-3">
              {detailListing.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detailListing.logo_url}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg border border-border bg-white object-contain p-0.5"
                />
              )}
              <div>
                <p className="text-lg font-extrabold text-text">{detailListing.name}</p>
                {detailListing.tagline && (
                  <p className="text-sm font-semibold text-teal2">{detailListing.tagline}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {detailInterest && (
                <span className="w-fit rounded-full border border-blue px-2.5 py-0.5 text-xs font-semibold text-blue">
                  {detailInterest.emoji ? `${detailInterest.emoji} ` : ""}
                  {labelFor(detailInterest)}
                </span>
              )}
              <span className="text-xs font-semibold text-muted">
                {t(`statusBadge.${detailListing.status}`)}
              </span>
            </div>

            {detailListing.description && (
              <div>
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                  {t("descriptionLabel")}
                </h3>
                <p className="text-sm text-text">{detailListing.description}</p>
              </div>
            )}

            <div>
              <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                {t("addressLabel")}
              </h3>
              <p className="text-sm text-text">
                {detailListing.city}
                {detailListing.address ? ` — ${detailListing.address}` : ""}
              </p>
            </div>

            {(detailListing.phone || detailListing.website) && (
              <div className="flex flex-wrap gap-3 text-sm">
                {detailListing.phone && (
                  <a
                    href={`tel:${detailListing.phone}`}
                    className="font-semibold text-teal2 hover:underline"
                  >
                    📞 {detailListing.phone}
                  </a>
                )}
                {detailListing.website && (
                  <a
                    href={detailListing.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-teal2 hover:underline"
                  >
                    🌐 {detailListing.website}
                  </a>
                )}
              </div>
            )}

            <div className="flex justify-between border-t border-border pt-3 text-xs text-muted">
              <span>
                {t("submittedByLabel")}:{" "}
                {detailListing.profile_id && submitters.has(detailListing.profile_id) ? (
                  <Link
                    href={`/profile/${detailListing.profile_id}`}
                    className="font-semibold text-teal2 hover:underline"
                  >
                    {submitterName(detailListing.profile_id)}
                  </Link>
                ) : (
                  submitterName(detailListing.profile_id)
                )}
              </span>
              <span>{new Date(detailListing.created_at).toLocaleDateString(locale)}</span>
            </div>

            <button
              type="button"
              onClick={() => handleToggleActive(detailListing)}
              className="rounded-full px-4 py-2.5 text-sm font-bold text-white"
              style={{
                background: detailListing.status === "active" ? "#e55" : "var(--teal2)",
              }}
            >
              {t(detailListing.status === "active" ? "actions.deactivate" : "actions.activate")}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
