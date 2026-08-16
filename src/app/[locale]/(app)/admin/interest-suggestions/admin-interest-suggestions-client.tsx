"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  approveInterestSuggestion,
  rejectInterestSuggestion,
} from "@/lib/interest-suggestions/queries";
import { logAdminAction } from "@/lib/admin/queries";
import type { InterestSuggestionWithProfile } from "@/lib/admin/types";
import type { Interest } from "@/lib/profile/types";
import { normalizeForSearch } from "@/lib/text";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

function profileDisplayName(
  profile: { full_name: string | null; last_name: string | null } | null | undefined,
  deletedLabel: string
): string {
  return profile?.full_name
    ? [profile.full_name, profile.last_name].filter(Boolean).join(" ")
    : deletedLabel;
}

// "Pas besoin de sophistiqué" — a plain normalized-text comparison against
// every existing interest's fr/en label, not a fuzzy-matching library.
// Flags an equal or substring match either direction (covers "Rando" vs
// "Randonnée", "Escalade" vs "Escalade en salle", etc.).
function findSimilarInterest(label: string, allInterests: Interest[]): Interest | null {
  const normalized = normalizeForSearch(label);
  if (!normalized) return null;
  return (
    allInterests.find((interest) => {
      const fr = normalizeForSearch(interest.label_fr);
      const en = normalizeForSearch(interest.label_en);
      return (
        fr === normalized ||
        en === normalized ||
        fr.includes(normalized) ||
        normalized.includes(fr) ||
        en.includes(normalized) ||
        normalized.includes(en)
      );
    }) ?? null
  );
}

export function AdminInterestSuggestionsClient({
  adminId,
  initialSuggestions,
  allInterests,
}: {
  adminId: string;
  initialSuggestions: InterestSuggestionWithProfile[];
  allInterests: Interest[];
}) {
  const t = useTranslations("Admin.interestSuggestions");
  // actionSuccess/actionError are shared top-level Admin keys (same ones
  // the reports queue reuses for its own feedback Notice) — a second
  // translator instance rather than duplicating those two strings here.
  const tAdmin = useTranslations("Admin");
  const tCategory = useTranslations("InterestCategories");
  const locale = useLocale();
  const router = useRouter();

  const [suggestions, setSuggestions] =
    useState<InterestSuggestionWithProfile[]>(initialSuggestions);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [approveTarget, setApproveTarget] = useState<InterestSuggestionWithProfile | null>(null);
  const [labelFr, setLabelFr] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [approving, setApproving] = useState(false);

  function openApprove(suggestion: InterestSuggestionWithProfile) {
    setApproveTarget(suggestion);
    setLabelFr(suggestion.locale === "fr" ? suggestion.label : "");
    setLabelEn(suggestion.locale === "en" ? suggestion.label : "");
  }

  function closeApprove() {
    if (approving) return;
    setApproveTarget(null);
  }

  async function handleApprove() {
    if (!approveTarget || !labelFr.trim() || !labelEn.trim()) return;
    setApproving(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      await approveInterestSuggestion(
        supabase,
        approveTarget.id,
        adminId,
        labelFr.trim(),
        labelEn.trim()
      );
      setSuggestions((prev) => prev.filter((s) => s.id !== approveTarget.id));
      logAdminAction(supabase, {
        adminId,
        actionType: "approve_interest_suggestion",
        targetType: "interest_suggestion",
        targetId: approveTarget.id,
      }).catch(() => {});
      setApproveTarget(null);
      setFeedback("success");
      // The sidebar's pending-suggestions badge count is fetched server-side
      // in AdminLayout — refresh so it drops without a full navigation.
      router.refresh();
    } catch {
      setFeedback("error");
    } finally {
      setApproving(false);
    }
  }

  // Deliberately no confirmation modal here, unlike approve/resolve above —
  // explicit product requirement to keep rejection a single, light action.
  async function handleReject(suggestion: InterestSuggestionWithProfile) {
    setBusyId(suggestion.id);
    setFeedback(null);
    try {
      const supabase = createClient();
      await rejectInterestSuggestion(supabase, suggestion.id, adminId);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      logAdminAction(supabase, {
        adminId,
        actionType: "reject_interest_suggestion",
        targetType: "interest_suggestion",
        targetId: suggestion.id,
      }).catch(() => {});
      setFeedback("success");
      router.refresh();
    } catch {
      setFeedback("error");
    } finally {
      setBusyId(null);
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

      {suggestions.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("noSuggestions")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {suggestions.map((suggestion) => {
            const similar = findSimilarInterest(suggestion.label, allInterests);
            return (
              <div
                key={suggestion.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {t("suggestedByLabel")}:{" "}
                    <span className="font-semibold text-text">
                      {profileDisplayName(suggestion.suggesterProfile, "—")}
                    </span>
                  </span>
                  <span>{new Date(suggestion.created_at).toLocaleDateString(locale)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                    style={{ backgroundImage: "var(--grad)" }}
                  >
                    {suggestion.locale === "en" ? t("labelLangBadgeEn") : t("labelLangBadgeFr")}
                  </span>
                  <p className="text-sm font-bold text-text">{suggestion.label}</p>
                </div>

                <p className="text-sm text-muted">
                  {t("categoryLabel")}:{" "}
                  {tCategory.has(suggestion.category)
                    ? tCategory(suggestion.category)
                    : suggestion.category}
                </p>

                {similar && (
                  <p className="text-xs text-muted">
                    {t("similarHint", {
                      label: locale === "en" ? similar.label_en : similar.label_fr,
                    })}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openApprove(suggestion)}
                    className="rounded-full px-4 py-2 text-xs font-bold text-white"
                    style={{ backgroundImage: "var(--grad)" }}
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === suggestion.id}
                    onClick={() => handleReject(suggestion)}
                    className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted disabled:opacity-60"
                  >
                    {t("reject")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!approveTarget}
        onClose={closeApprove}
        title={approveTarget ? t("approveModalTitle", { label: approveTarget.label }) : undefined}
      >
        {approveTarget && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">
                {t("labelFrLabel")}
              </span>
              <input
                type="text"
                value={labelFr}
                onChange={(e) => setLabelFr(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">
                {t("labelEnLabel")}
              </span>
              <input
                type="text"
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
              />
            </label>
            <p className="text-xs text-muted">
              {t("categoryLabel")}:{" "}
              {tCategory.has(approveTarget.category)
                ? tCategory(approveTarget.category)
                : approveTarget.category}
            </p>

            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeApprove}
                disabled={approving}
                className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={approving || !labelFr.trim() || !labelEn.trim()}
                className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundImage: "var(--grad)" }}
              >
                {approving ? "…" : t("confirmApprove")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
