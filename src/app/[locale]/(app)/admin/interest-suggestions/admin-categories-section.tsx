"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import {
  logAdminAction,
  createInterestCategory,
  updateInterestCategory,
  deleteInterestCategory,
} from "@/lib/admin/queries";
import type { Interest, InterestCategory } from "@/lib/profile/types";
import { normalizeForSearch } from "@/lib/text";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

function slugifyCategory(value: string): string {
  return normalizeForSearch(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sortCategories(a: InterestCategory, b: InterestCategory): number {
  return a.sort_order - b.sort_order || a.label_fr.localeCompare(b.label_fr);
}

export function AdminCategoriesSection({
  adminId,
  categories,
  interests,
  categoryName,
  onChange,
}: {
  adminId: string;
  categories: InterestCategory[];
  interests: Interest[];
  categoryName: (slug: string) => string;
  onChange: (next: InterestCategory[]) => void;
}) {
  const t = useTranslations("Admin.interestSuggestions");
  const tAdmin = useTranslations("Admin");

  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<InterestCategory | null>(null);
  const [labelFr, setLabelFr] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [labelEs, setLabelEs] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<InterestCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  function usageCount(categorySlug: string) {
    return interests.filter((i) => i.category === categorySlug).length;
  }

  function openCreate() {
    setFormMode("create");
    setEditing(null);
    setLabelFr("");
    setLabelEn("");
    setLabelEs("");
    setSlug("");
    setSlugTouched(false);
    const max = categories.filter((c) => c.sort_order < 1000).reduce((m, c) => Math.max(m, c.sort_order), 0);
    setSortOrder(String(max + 10));
  }

  function openEdit(category: InterestCategory) {
    setFormMode("edit");
    setEditing(category);
    setLabelFr(category.label_fr);
    setLabelEn(category.label_en);
    setLabelEs(category.label_es ?? "");
    setSlug(category.slug);
    setSlugTouched(true);
    setSortOrder(String(category.sort_order));
  }

  function closeForm() {
    if (saving) return;
    setFormMode(null);
    setEditing(null);
  }

  async function handleSave() {
    if (!formMode || !labelFr.trim() || !labelEn.trim() || !slug.trim()) return;
    setSaving(true);
    setFeedback(null);
    const payload = {
      labelFr: labelFr.trim(),
      labelEn: labelEn.trim(),
      labelEs: labelEs.trim() || null,
      sortOrder: Number.parseInt(sortOrder, 10) || 0,
    };
    try {
      const supabase = createClient();
      if (formMode === "create") {
        const created = await createInterestCategory(supabase, { ...payload, slug: slug.trim() });
        onChange([...categories, created].sort(sortCategories));
        logAdminAction(supabase, {
          adminId,
          actionType: "create_interest_category",
          targetType: "interest_category",
          targetId: created.slug,
        }).catch(() => {});
      } else if (editing) {
        const updated = await updateInterestCategory(supabase, editing.slug, payload);
        onChange(categories.map((c) => (c.slug === updated.slug ? updated : c)).sort(sortCategories));
        logAdminAction(supabase, {
          adminId,
          actionType: "update_interest_category",
          targetType: "interest_category",
          targetId: updated.slug,
        }).catch(() => {});
      }
      setFeedback({ kind: "success", message: tAdmin("actionSuccess") });
      setFormMode(null);
      setEditing(null);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setFeedback({
        kind: "error",
        message:
          code === "23505"
            ? t("duplicateSlugError")
            : code === "23514"
              ? t("categorySlugInvalid")
              : tAdmin("actionError"),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      // No FK on interests.category, so check usage ourselves.
      const { count, error } = await supabase
        .from("interests")
        .select("id", { count: "exact", head: true })
        .eq("category", deleteTarget.slug);
      if (error) throw error;
      if ((count ?? 0) > 0) {
        setFeedback({ kind: "error", message: t("categoryInUseError") });
        setDeleteTarget(null);
        return;
      }
      await deleteInterestCategory(supabase, deleteTarget.slug);
      onChange(categories.filter((c) => c.slug !== deleteTarget.slug));
      logAdminAction(supabase, {
        adminId,
        actionType: "delete_interest_category",
        targetType: "interest_category",
        targetId: deleteTarget.slug,
      }).catch(() => {});
      setFeedback({ kind: "success", message: tAdmin("actionSuccess") });
      setDeleteTarget(null);
    } catch {
      setFeedback({ kind: "error", message: tAdmin("actionError") });
    } finally {
      setDeleting(false);
    }
  }

  const inputClass =
    "rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2";
  const labelClass = "text-xs font-bold uppercase tracking-wide text-muted";

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-text">{t("categoriesTitle")}</h2>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full px-4 py-2 text-xs font-bold text-white"
          style={{ backgroundImage: "var(--grad)" }}
        >
          + {t("addCategory")}
        </button>
      </div>

      {feedback && <Notice kind={feedback.kind} message={feedback.message} className="mb-4 max-w-md" />}

      <div className="flex flex-col gap-2">
        {categories.map((category) => (
          <div
            key={category.slug}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
          >
            <span>
              <span className="font-semibold text-text">{categoryName(category.slug)}</span>{" "}
              <span className="text-xs text-muted">
                {category.slug} · {t("categoryInterestCount", { count: usageCount(category.slug) })}
              </span>
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                onClick={() => openEdit(category)}
                className="rounded-full px-2 py-1 text-xs font-semibold text-teal2 hover:bg-bg"
              >
                {t("edit")}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(category)}
                className="rounded-full px-2 py-1 text-xs font-semibold text-[#e55] hover:bg-bg"
              >
                {t("delete")}
              </button>
            </span>
          </div>
        ))}
      </div>

      <Modal
        open={formMode !== null}
        onClose={closeForm}
        title={
          formMode === "edit"
            ? t("editModalTitle", { label: editing?.label_fr ?? "" })
            : t("addCategoryModalTitle")
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("labelFrLabel")}</span>
            <input
              type="text"
              value={labelFr}
              onChange={(e) => {
                setLabelFr(e.target.value);
                if (formMode === "create" && !slugTouched) setSlug(slugifyCategory(e.target.value));
              }}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("labelEnLabel")}</span>
            <input type="text" value={labelEn} onChange={(e) => setLabelEn(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("labelEsLabel")}</span>
            <input type="text" value={labelEs} onChange={(e) => setLabelEs(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("slugLabel")}</span>
            <input
              type="text"
              value={slug}
              disabled={formMode === "edit"}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
              className={`${inputClass} disabled:opacity-60`}
            />
            {formMode === "edit" && <span className="text-xs text-muted">{t("categorySlugLocked")}</span>}
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t("sortOrderLabel")}</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className={`${inputClass} w-28`}
            />
          </label>

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              disabled={saving}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !labelFr.trim() || !labelEn.trim() || !slug.trim()}
              className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {saving ? "…" : formMode === "edit" ? t("confirmEdit") : t("confirmAdd")}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        title={deleteTarget ? t("deleteConfirmTitle", { label: deleteTarget.label_fr }) : undefined}
      >
        {deleteTarget && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{t("deleteCategoryConfirmBody")}</p>
            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleDelete}
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
    </section>
  );
}
