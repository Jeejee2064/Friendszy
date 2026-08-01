"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  listAllPartnerListingsForAdmin,
  setPartnerListingActive,
  type PartnerListingRow,
} from "@/lib/partners/queries";
import { logAdminAction } from "@/lib/admin/queries";
import type { Interest } from "@/lib/profile/types";
import { Notice } from "@/components/ui/notice";

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
  const locale = useLocale();

  const [listings, setListings] = useState<PartnerListingRow[]>(initialListings);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

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
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text">{listing.name}</p>
                  <p className="truncate text-xs text-muted">
                    {listing.city}
                    {interest ? ` · ${interest.emoji ? `${interest.emoji} ` : ""}${labelFor(interest)}` : ""}
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted">
                  {t(`statusBadge.${listing.status}`)}
                </span>
                <button
                  type="button"
                  onClick={() => handleToggleActive(listing)}
                  className="shrink-0 rounded-full px-3 py-2 text-xs font-bold text-white"
                  style={{
                    background: listing.status === "active" ? "#e55" : "var(--teal2)",
                  }}
                >
                  {t(listing.status === "active" ? "actions.deactivate" : "actions.activate")}
                </button>
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
    </div>
  );
}
