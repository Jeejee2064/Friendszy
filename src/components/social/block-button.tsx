"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { blockUser } from "@/lib/blocks/queries";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

export function BlockButton({
  blockerId,
  blockedId,
  blockedName,
  onBlocked,
  compact = false,
}: {
  blockerId: string;
  blockedId: string;
  blockedName?: string | null;
  onBlocked?: () => void;
  compact?: boolean;
}) {
  const t = useTranslations("Report");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  function closeModal() {
    if (pending) return;
    setOpen(false);
    setError(false);
  }

  async function handleConfirm() {
    setPending(true);
    setError(false);
    try {
      const supabase = createClient();
      await blockUser(supabase, blockerId, blockedId);
      setOpen(false);
      if (onBlocked) {
        onBlocked();
      } else {
        router.refresh();
      }
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={compact ? t("blockAction") : undefined}
        className="text-xs font-semibold"
        style={{ color: "#e55" }}
      >
        {compact ? "🚫" : `🚫 ${t("blockAction")}`}
      </button>

      <Modal open={open} onClose={closeModal} title={t("confirmBlockTitle")}>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {t("confirmBlockBody", { name: blockedName ?? "" })}
          </p>

          {error && <Notice kind="error" message={t("error")} />}

          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={pending}
              className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
            >
              {t("cancel")}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending}
              className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "#e55" }}
            >
              {pending ? "…" : t("blockAction")}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
