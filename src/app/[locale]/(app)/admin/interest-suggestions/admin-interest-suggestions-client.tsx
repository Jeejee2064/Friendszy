"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  approveInterestSuggestion,
  rejectInterestSuggestion,
} from "@/lib/interest-suggestions/queries";
import { logAdminAction, createInterest, updateInterest, deleteInterest } from "@/lib/admin/queries";
import type { InterestSuggestionWithProfile } from "@/lib/admin/types";
import type { Interest } from "@/lib/profile/types";
import { normalizeForSearch } from "@/lib/text";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

// Same 11 values the interest_suggestions.category CHECK constraint accepts
// (10 real categories + "autre") — keeping the manual-add/edit form limited
// to these keeps every interest's category renderable via InterestCategories
// everywhere else in the app, instead of admins free-typing arbitrary text.
const CATEGORY_KEYS = [
  "sports",
  "plein_air",
  "arts_creatifs",
  "jeux",
  "lecture",
  "cinema_culture_pop",
  "genres_musicaux",
  "instruments_musique",
  "cuisine",
  "bien_etre",
  "autre",
] as const;

function slugify(value: string): string {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortInterests(a: Interest, b: Interest): number {
  return (
    (a.category ?? "").localeCompare(b.category ?? "") || a.label_fr.localeCompare(b.label_fr)
  );
}

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

  // Interest catalogue (list + manual add/edit/delete) ---------------------
  const [interests, setInterests] = useState<Interest[]>([...allInterests].sort(sortInterests));
  const [search, setSearch] = useState("");
  const [catalogFeedback, setCatalogFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingInterest, setEditingInterest] = useState<Interest | null>(null);
  const [iLabelFr, setILabelFr] = useState("");
  const [iLabelEn, setILabelEn] = useState("");
  const [iCategory, setICategory] = useState<string>(CATEGORY_KEYS[0]);
  const [iEmoji, setIEmoji] = useState("");
  const [iSlug, setISlug] = useState("");
  const [iSlugTouched, setISlugTouched] = useState(false);
  const [savingInterest, setSavingInterest] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Interest | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredInterests = useMemo(() => {
    const query = normalizeForSearch(search);
    if (!query) return interests;
    return interests.filter((interest) => {
      const fr = normalizeForSearch(interest.label_fr);
      const en = normalizeForSearch(interest.label_en);
      return fr.includes(query) || en.includes(query) || interest.slug.includes(query);
    });
  }, [interests, search]);

  const groupedInterests = useMemo(() => {
    const groups = new Map<string, Interest[]>();
    for (const interest of filteredInterests) {
      const key = interest.category ?? "autre";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(interest);
    }
    return [...groups.entries()];
  }, [filteredInterests]);

  function openCreate() {
    setFormMode("create");
    setEditingInterest(null);
    setILabelFr("");
    setILabelEn("");
    setICategory(CATEGORY_KEYS[0]);
    setIEmoji("");
    setISlug("");
    setISlugTouched(false);
  }

  function openEdit(interest: Interest) {
    setFormMode("edit");
    setEditingInterest(interest);
    setILabelFr(interest.label_fr);
    setILabelEn(interest.label_en);
    setICategory(interest.category ?? CATEGORY_KEYS[0]);
    setIEmoji(interest.emoji ?? "");
    setISlug(interest.slug);
    setISlugTouched(true); // never silently rewrite an existing, already-referenced slug
  }

  function closeForm() {
    if (savingInterest) return;
    setFormMode(null);
    setEditingInterest(null);
  }

  function handleLabelFrChange(value: string) {
    setILabelFr(value);
    if (formMode === "create" && !iSlugTouched) {
      setISlug(slugify(value));
    }
  }

  async function handleSaveInterest() {
    if (!formMode || !iLabelFr.trim() || !iLabelEn.trim() || !iSlug.trim()) return;
    setSavingInterest(true);
    setCatalogFeedback(null);
    const payload = {
      slug: iSlug.trim(),
      labelFr: iLabelFr.trim(),
      labelEn: iLabelEn.trim(),
      category: iCategory,
      emoji: iEmoji.trim() || null,
    };
    try {
      const supabase = createClient();
      if (formMode === "create") {
        const created = await createInterest(supabase, payload);
        setInterests((prev) => [...prev, created].sort(sortInterests));
        logAdminAction(supabase, {
          adminId,
          actionType: "create_interest",
          targetType: "interest",
          targetId: String(created.id),
        }).catch(() => {});
      } else if (editingInterest) {
        const updated = await updateInterest(supabase, editingInterest.id, payload);
        setInterests((prev) =>
          prev.map((i) => (i.id === updated.id ? updated : i)).sort(sortInterests)
        );
        logAdminAction(supabase, {
          adminId,
          actionType: "update_interest",
          targetType: "interest",
          targetId: String(updated.id),
        }).catch(() => {});
      }
      setCatalogFeedback({ kind: "success", message: tAdmin("actionSuccess") });
      setFormMode(null);
      setEditingInterest(null);
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setCatalogFeedback({
        kind: "error",
        message: code === "23505" ? t("duplicateSlugError") : tAdmin("actionError"),
      });
    } finally {
      setSavingInterest(false);
    }
  }

  function closeDelete() {
    if (deleting) return;
    setDeleteTarget(null);
  }

  async function handleDeleteInterest() {
    if (!deleteTarget) return;
    setDeleting(true);
    setCatalogFeedback(null);
    try {
      const supabase = createClient();
      await deleteInterest(supabase, deleteTarget.id);
      setInterests((prev) => prev.filter((i) => i.id !== deleteTarget.id));
      logAdminAction(supabase, {
        adminId,
        actionType: "delete_interest",
        targetType: "interest",
        targetId: String(deleteTarget.id),
      }).catch(() => {});
      setCatalogFeedback({ kind: "success", message: tAdmin("actionSuccess") });
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setCatalogFeedback({
        kind: "error",
        message: code === "23503" ? t("inUseError") : tAdmin("actionError"),
      });
    } finally {
      setDeleting(false);
    }
  }

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

      {/* Pending suggestions queue */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-extrabold text-text">{t("pendingSectionTitle")}</h2>

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
              const similar = findSimilarInterest(suggestion.label, interests);
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
      </section>

      {/* Catalogue: full interest list with manual add/edit/delete */}
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-text">{t("catalogTitle")}</h2>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-full px-4 py-2 text-xs font-bold text-white"
            style={{ backgroundImage: "var(--grad)" }}
          >
            + {t("addInterest")}
          </button>
        </div>

        {catalogFeedback && (
          <Notice
            kind={catalogFeedback.kind}
            message={catalogFeedback.message}
            className="mb-4 max-w-md"
          />
        )}

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="mb-4 w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
        />

        {filteredInterests.length === 0 ? (
          <p className="text-center text-sm text-muted">{t("noInterests")}</p>
        ) : (
          <div className="flex flex-col gap-6">
            {groupedInterests.map(([category, items]) => (
              <div key={category}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                  {tCategory.has(category) ? tCategory(category) : category}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((interest) => (
                    <div
                      key={interest.id}
                      className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-3 pr-1.5 text-sm"
                    >
                      <span>
                        {interest.emoji ? `${interest.emoji} ` : ""}
                        {locale === "en" ? interest.label_en : interest.label_fr}
                      </span>
                      <button
                        type="button"
                        onClick={() => openEdit(interest)}
                        className="rounded-full px-2 py-1 text-xs font-semibold text-teal2 hover:bg-bg"
                      >
                        {t("edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(interest)}
                        className="rounded-full px-2 py-1 text-xs font-semibold text-[#e55] hover:bg-bg"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

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

      <Modal
        open={formMode !== null}
        onClose={closeForm}
        title={formMode === "edit" ? t("editModalTitle", { label: editingInterest?.label_fr ?? "" }) : t("addModalTitle")}
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("labelFrLabel")}
            </span>
            <input
              type="text"
              value={iLabelFr}
              onChange={(e) => handleLabelFrChange(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("labelEnLabel")}
            </span>
            <input
              type="text"
              value={iLabelEn}
              onChange={(e) => setILabelEn(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("categoryLabel")}
            </span>
            <select
              value={iCategory}
              onChange={(e) => setICategory(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm normal-case text-text outline-none focus:border-teal2"
            >
              {CATEGORY_KEYS.map((key) => (
                <option key={key} value={key}>
                  {tCategory(key)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("emojiLabel")}
            </span>
            <input
              type="text"
              value={iEmoji}
              onChange={(e) => setIEmoji(e.target.value)}
              maxLength={8}
              className="w-24 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("slugLabel")}
            </span>
            <input
              type="text"
              value={iSlug}
              onChange={(e) => {
                setISlug(e.target.value);
                setISlugTouched(true);
              }}
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
            />
          </label>

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              disabled={savingInterest}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSaveInterest}
              disabled={savingInterest || !iLabelFr.trim() || !iLabelEn.trim() || !iSlug.trim()}
              className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {savingInterest ? "…" : formMode === "edit" ? t("confirmEdit") : t("confirmAdd")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={closeDelete}
        title={deleteTarget ? t("deleteConfirmTitle", { label: deleteTarget.label_fr }) : undefined}
      >
        {deleteTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{t("deleteConfirmBody")}</p>
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDeleteInterest}
                disabled={deleting}
                className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "#e55" }}
              >
                {deleting ? "…" : t("confirmDelete")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
