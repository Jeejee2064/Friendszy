"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteMyAccount } from "@/lib/account/actions";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

export function SettingsPageClient({ locale }: { locale: string }) {
  const t = useTranslations("Settings");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState(false);
  const [isPending, startTransition] = useTransition();

  const confirmWord = t("deleteConfirmWord");
  const canDelete = confirmText.trim().toUpperCase() === confirmWord.toUpperCase();

  async function handleExport() {
    setExporting(true);
    setExportError(false);
    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) throw new Error("export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `friendszy-donnees-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
    } finally {
      setExporting(false);
    }
  }

  function closeConfirm() {
    if (isPending) return;
    setConfirmOpen(false);
    setConfirmText("");
    setDeleteError(false);
  }

  function handleDelete() {
    setDeleteError(false);
    startTransition(async () => {
      const result = await deleteMyAccount(locale);
      if (result?.error) setDeleteError(true);
    });
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      <div className="flex max-w-md flex-col gap-4">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 font-bold text-text">{t("exportTitle")}</h2>
          <p className="mb-4 text-sm text-muted">{t("exportBody")}</p>
          {exportError && (
            <Notice kind="error" message={t("exportError")} className="mb-3" />
          )}
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {exporting ? "…" : t("exportButton")}
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 font-bold text-text">{t("deleteTitle")}</h2>
          <p className="mb-4 text-sm text-muted">{t("deleteBody")}</p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="rounded-full px-4 py-2.5 text-sm font-bold text-white"
            style={{ background: "#e55" }}
          >
            {t("deleteButton")}
          </button>
        </div>
      </div>

      <Modal open={confirmOpen} onClose={closeConfirm} title={t("deleteTitle")}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">{t("deleteWarning")}</p>
          <p className="text-sm text-text">
            {t("deleteConfirmPrompt", { word: confirmWord })}
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
          />

          {deleteError && <Notice kind="error" message={t("deleteError")} />}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeConfirm}
              disabled={isPending}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete || isPending}
              className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#e55" }}
            >
              {isPending ? "…" : t("deleteConfirmButton")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
