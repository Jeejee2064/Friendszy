"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { createReport } from "@/lib/reports/queries";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

const REPORT_REASONS = [
  "harassment",
  "inappropriate_content",
  "fake_profile",
  "spam",
  "other",
] as const;

export function ReportButton({
  reporterId,
  targetType,
  targetId,
  compact = false,
}: {
  reporterId: string;
  targetType: "profile" | "message";
  targetId: string;
  compact?: boolean;
}) {
  const t = useTranslations("Report");
  const [open, setOpen] = useState(false);
  const [reasonCode, setReasonCode] =
    useState<(typeof REPORT_REASONS)[number]>("harassment");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [done, setDone] = useState(false);

  function openModal() {
    setReasonCode("harassment");
    setDetails("");
    setError(false);
    setSuccess(false);
    setOpen(true);
  }

  function handleClose() {
    if (pending) return;
    setOpen(false);
    if (success) setDone(true);
  }

  async function handleSubmit() {
    setPending(true);
    setError(false);
    const trimmed = details.trim();
    const reason = trimmed ? `${reasonCode}: ${trimmed}` : reasonCode;
    try {
      const supabase = createClient();
      await createReport(supabase, reporterId, targetType, targetId, reason);
      setSuccess(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return <span className="text-xs text-muted">{t("reported")}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title={compact ? t("action") : undefined}
        className="text-xs font-semibold"
        style={{ color: "#e55" }}
      >
        {compact ? "🚩" : `🚩 ${t("action")}`}
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title={targetType === "profile" ? t("modalTitleProfile") : t("modalTitleMessage")}
      >
        {success ? (
          <div className="flex flex-col gap-3">
            <Notice kind="success" message={t("success")} />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full px-4 py-2.5 text-sm font-bold text-white"
                style={{ backgroundImage: "var(--grad)" }}
              >
                {t("close")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((code) => (
                <label key={code} className="flex items-center gap-2 text-sm text-text">
                  <input
                    type="radio"
                    name={`report-reason-${targetId}`}
                    checked={reasonCode === code}
                    onChange={() => setReasonCode(code)}
                  />
                  {t(`reasons.${code}`)}
                </label>
              ))}
            </div>

            <textarea
              rows={3}
              placeholder={t("detailsPlaceholder")}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
            />

            {error && <Notice kind="error" message={t("error")} />}

            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={pending}
                className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={pending}
                className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ backgroundImage: "var(--grad)" }}
              >
                {pending ? "…" : t("submit")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
