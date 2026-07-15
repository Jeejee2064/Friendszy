"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { updateReportStatus } from "@/lib/reports/queries";
import { setModerationStatus, removeMessageAsAdmin } from "@/lib/admin/queries";
import type { ModerationStatus, ReportWithTarget } from "@/lib/admin/types";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

type ConfirmKind = "suspend" | "ban" | "reactivate" | "removeMessage";
type ConfirmAction = { kind: ConfirmKind; report: ReportWithTarget };

function targetUserId(report: ReportWithTarget): string | null {
  if (report.target_type === "profile") return report.target_id;
  if (report.target_type === "message") return report.targetMessage?.sender_id ?? null;
  return null;
}

function targetDisplayName(report: ReportWithTarget, deletedLabel: string): string {
  if (report.target_type === "profile")
    return report.targetProfile?.full_name ?? deletedLabel;
  if (report.target_type === "message")
    return report.targetMessage?.senderProfile?.full_name ?? deletedLabel;
  return "";
}

export function AdminReportsClient({
  adminId,
  initialReports,
}: {
  adminId: string;
  initialReports: ReportWithTarget[];
}) {
  const t = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [reports, setReports] = useState<ReportWithTarget[]>(initialReports);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pending, setPending] = useState(false);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  function closeConfirm() {
    if (pending) return;
    setConfirmAction(null);
  }

  async function handleConfirm() {
    if (!confirmAction) return;
    setPending(true);
    setFeedback(null);
    const { kind, report } = confirmAction;
    try {
      const supabase = createClient();
      if (kind === "removeMessage") {
        if (!report.targetMessage) return;
        await removeMessageAsAdmin(supabase, report.targetMessage.id, adminId);
        setReports((prev) =>
          prev.map((r) =>
            r.id === report.id && r.targetMessage
              ? {
                  ...r,
                  targetMessage: {
                    ...r.targetMessage,
                    removed_at: new Date().toISOString(),
                    removed_by: adminId,
                  },
                }
              : r
          )
        );
      } else {
        const uid = targetUserId(report);
        if (!uid) return;
        const status: ModerationStatus =
          kind === "suspend" ? "suspended" : kind === "ban" ? "banned" : "active";
        await setModerationStatus(supabase, uid, status);
        setReports((prev) =>
          prev.map((r) => (r.id === report.id ? { ...r, targetModerationStatus: status } : r))
        );
      }
      setConfirmAction(null);
      setFeedback("success");
    } catch {
      setFeedback("error");
    } finally {
      setPending(false);
    }
  }

  async function handleTriage(reportId: string, status: "resolved" | "dismissed") {
    setBusyReportId(reportId);
    setFeedback(null);
    try {
      const supabase = createClient();
      await updateReportStatus(supabase, reportId, status, adminId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      setFeedback("success");
    } catch {
      setFeedback("error");
    } finally {
      setBusyReportId(null);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      {feedback && (
        <Notice
          kind={feedback}
          message={feedback === "success" ? t("actionSuccess") : t("actionError")}
          className="mb-4 max-w-md"
        />
      )}

      {reports.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("noReports")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {reports.map((report) => {
            const suspendedOrBanned =
              report.targetModerationStatus === "suspended" ||
              report.targetModerationStatus === "banned";
            const canModerate = targetUserId(report) !== null;

            return (
              <div
                key={report.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {t("reporterLabel")}:{" "}
                    <span className="font-semibold text-text">
                      {report.reporterProfile?.full_name ?? "—"}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {report.status === "reviewing" && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: "var(--bg)", color: "var(--dark)" }}
                      >
                        {t("reviewingBadge")}
                      </span>
                    )}
                    <span>
                      {t("dateLabel")}:{" "}
                      {new Date(report.created_at).toLocaleDateString(locale)}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-text">
                  <span className="font-bold">{t("reasonLabel")}:</span> {report.reason}
                </p>

                {report.target_type === "profile" ? (
                  <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <div
                      className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
                      style={
                        !report.targetProfile?.avatar_url
                          ? { backgroundImage: "var(--grad)" }
                          : undefined
                      }
                    >
                      {report.targetProfile?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={report.targetProfile.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                          {(report.targetProfile?.full_name ?? "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-text">
                        {t("targetTypeProfile")}:{" "}
                        {report.targetProfile?.full_name ?? tCommon("deletedUser")}
                      </p>
                      {report.targetModerationStatus && (
                        <p className="text-xs text-muted">
                          {t(`statusBadge.${report.targetModerationStatus}`)}
                        </p>
                      )}
                    </div>
                  </div>
                ) : report.target_type === "message" ? (
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-sm font-bold text-text">
                      {t("targetTypeMessage")}:{" "}
                      {report.targetMessage?.senderProfile?.full_name ?? tCommon("deletedUser")}
                    </p>
                    <p
                      className={`mt-1 text-sm ${
                        report.targetMessage?.removed_at ? "italic text-muted" : "text-text"
                      }`}
                    >
                      {report.targetMessage?.removed_at
                        ? t("messageRemovedPlaceholder")
                        : (report.targetMessage?.content ?? "—")}
                    </p>
                    {report.targetModerationStatus && (
                      <p className="mt-1 text-xs text-muted">
                        {t(`statusBadge.${report.targetModerationStatus}`)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm italic text-muted">{t("targetTypeUnsupported")}</p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {canModerate &&
                    (suspendedOrBanned ? (
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ kind: "reactivate", report })}
                        className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-teal2"
                      >
                        {t("actions.reactivate")}
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ kind: "suspend", report })}
                          className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-text"
                        >
                          {t("actions.suspend")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ kind: "ban", report })}
                          className="rounded-full px-3 py-2 text-xs font-bold text-white"
                          style={{ background: "#e55" }}
                        >
                          {t("actions.ban")}
                        </button>
                      </>
                    ))}

                  {report.target_type === "message" && !report.targetMessage?.removed_at && (
                    <button
                      type="button"
                      onClick={() => setConfirmAction({ kind: "removeMessage", report })}
                      className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-text"
                    >
                      {t("actions.removeMessage")}
                    </button>
                  )}

                  <span className="ml-auto flex gap-2">
                    <button
                      type="button"
                      disabled={busyReportId === report.id}
                      onClick={() => handleTriage(report.id, "dismissed")}
                      className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted disabled:opacity-60"
                    >
                      {t("actions.dismiss")}
                    </button>
                    <button
                      type="button"
                      disabled={busyReportId === report.id}
                      onClick={() => handleTriage(report.id, "resolved")}
                      className="rounded-full px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                      style={{ backgroundImage: "var(--grad)" }}
                    >
                      {t("actions.resolve")}
                    </button>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!confirmAction}
        onClose={closeConfirm}
        title={
          confirmAction
            ? confirmAction.kind === "removeMessage"
              ? t("confirm.removeMessageTitle")
              : t(`confirm.${confirmAction.kind}Title`)
            : undefined
        }
      >
        {confirmAction && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {confirmAction.kind === "removeMessage"
                ? t("confirm.removeMessageBody")
                : t(`confirm.${confirmAction.kind}Body`, {
                    name: targetDisplayName(confirmAction.report, tCommon("deletedUser")),
                  })}
            </p>

            <div className="mt-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirm}
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
                style={
                  confirmAction.kind === "reactivate"
                    ? { backgroundImage: "var(--grad)" }
                    : { background: "#e55" }
                }
              >
                {pending ? "…" : t(`actions.${confirmAction.kind}`)}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
