"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction, createCity, updateCity, deleteCity } from "@/lib/admin/queries";
import type { City } from "@/lib/profile/types";
import { normalizeCityForSearch } from "@/lib/search/cities";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

function sortCities(a: City, b: City): number {
  return a.name.localeCompare(b.name);
}

export function AdminCitiesClient({
  adminId,
  initialCities,
}: {
  adminId: string;
  initialCities: City[];
}) {
  const t = useTranslations("Admin.cities");
  // Shared top-level Admin keys, same ones the interests catalogue reuses
  // for its own feedback Notice — a second translator instance rather than
  // duplicating those two strings here.
  const tAdmin = useTranslations("Admin");
  const router = useRouter();

  const [cities, setCities] = useState<City[]>([...initialCities].sort(sortCities));
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<City | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filteredCities = useMemo(() => {
    const query = normalizeCityForSearch(search);
    if (!query) return cities;
    return cities.filter((city) => normalizeCityForSearch(city.name).includes(query));
  }, [cities, search]);

  function openCreate() {
    setFormMode("create");
    setEditingCity(null);
    setName("");
  }

  function openEdit(city: City) {
    setFormMode("edit");
    setEditingCity(city);
    setName(city.name);
  }

  function closeForm() {
    if (saving) return;
    setFormMode(null);
    setEditingCity(null);
  }

  async function handleSave() {
    if (!formMode || !name.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      if (formMode === "create") {
        const created = await createCity(supabase, name.trim());
        setCities((prev) => [...prev, created].sort(sortCities));
        logAdminAction(supabase, {
          adminId,
          actionType: "create_city",
          targetType: "city",
          targetId: String(created.id),
        }).catch(() => {});
      } else if (editingCity) {
        const updated = await updateCity(supabase, editingCity.id, name.trim());
        setCities((prev) => prev.map((c) => (c.id === updated.id ? updated : c)).sort(sortCities));
        logAdminAction(supabase, {
          adminId,
          actionType: "update_city",
          targetType: "city",
          targetId: String(updated.id),
        }).catch(() => {});
      }
      setFeedback({ kind: "success", message: tAdmin("actionSuccess") });
      setFormMode(null);
      setEditingCity(null);
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setFeedback({
        kind: "error",
        message: code === "23505" ? t("duplicateNameError") : tAdmin("actionError"),
      });
    } finally {
      setSaving(false);
    }
  }

  function closeDelete() {
    if (deleting) return;
    setDeleteTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      await deleteCity(supabase, deleteTarget.id);
      setCities((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      logAdminAction(supabase, {
        adminId,
        actionType: "delete_city",
        targetType: "city",
        targetId: String(deleteTarget.id),
      }).catch(() => {});
      setFeedback({ kind: "success", message: tAdmin("actionSuccess") });
      setDeleteTarget(null);
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: tAdmin("actionError") });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-text">{t("title")}</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-full px-4 py-2 text-xs font-bold text-white"
          style={{ backgroundImage: "var(--grad)" }}
        >
          + {t("addCity")}
        </button>
      </div>

      {feedback && (
        <Notice kind={feedback.kind} message={feedback.message} className="mb-4 max-w-md" />
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="mb-4 w-full max-w-sm rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
      />

      {filteredCities.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("noCities")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {filteredCities.map((city) => (
            <div
              key={city.id}
              className="flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-3 pr-1.5 text-sm"
            >
              <span>{city.name}</span>
              <button
                type="button"
                onClick={() => openEdit(city)}
                className="rounded-full px-2 py-1 text-xs font-semibold text-teal2 hover:bg-bg"
              >
                {t("edit")}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(city)}
                className="rounded-full px-2 py-1 text-xs font-semibold text-[#e55] hover:bg-bg"
              >
                {t("delete")}
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={formMode !== null}
        onClose={closeForm}
        title={formMode === "edit" ? t("editModalTitle", { name: editingCity?.name ?? "" }) : t("addModalTitle")}
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">
              {t("nameLabel")}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
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
              disabled={saving || !name.trim()}
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
        onClose={closeDelete}
        title={deleteTarget ? t("deleteConfirmTitle", { name: deleteTarget.name }) : undefined}
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
    </div>
  );
}
