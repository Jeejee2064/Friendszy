"use client";

import { useMemo, useState } from "react";
import { useLocale, useNow, useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { updateReportStatus } from "@/lib/reports/queries";
import { setModerationStatus, removeMessageAsAdmin, logAdminAction } from "@/lib/admin/queries";
import type { ModerationStatus, ReportWithTarget } from "@/lib/admin/types";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

type ConfirmKind = "suspend" | "ban" | "reactivate" | "removeMessage";
type ConfirmAction = { kind: ConfirmKind; report: ReportWithTarget };

type TypeFilter = "all" | "profile" | "message";
type StatusFilter = "pending" | "resolved" | "dismissed";
type DateFilter = "all" | "today" | "7d" | "30d";

const PAGE_SIZE = 10;
const URGENT_THRESHOLD = 3;
const URGENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const NEW_ACCOUNT_WINDOW_MS = 48 * 60 * 60 * 1000;

function targetUserId(report: ReportWithTarget): string | null {
  if (report.target_type === "profile") return report.target_id;
  if (report.target_type === "message") return report.targetMessage?.sender_id ?? null;
  return null;
}

function profileDisplayName(
  profile: { full_name: string | null; last_name: string | null } | null | undefined,
  deletedLabel: string
): string {
  return profile?.full_name
    ? [profile.full_name, profile.last_name].filter(Boolean).join(" ")
    : deletedLabel;
}

function targetDisplayName(report: ReportWithTarget, deletedLabel: string): string {
  if (report.target_type === "profile")
    return profileDisplayName(report.targetProfile, deletedLabel);
  if (report.target_type === "message")
    return profileDisplayName(report.targetMessage?.senderProfile, deletedLabel);
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
  const now = useNow({ updateInterval: 60_000 });
  const [reports, setReports] = useState<ReportWithTarget[]>(initialReports);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [detailReport, setDetailReport] = useState<ReportWithTarget | null>(null);
  const [pending, setPending] = useState(false);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [page, setPage] = useState(1);

  // Urgency is about total report volume against a user, independent of the
  // status/type/date filters currently applied to the list view.
  const urgentUserIds = useMemo(() => {
    const nowMs = now.getTime();
    const countsByUser = new Map<string, number>();
    for (const r of reports) {
      const uid = targetUserId(r);
      if (!uid) continue;
      if (nowMs - new Date(r.created_at).getTime() > URGENT_WINDOW_MS) continue;
      countsByUser.set(uid, (countsByUser.get(uid) ?? 0) + 1);
    }
    return new Set(
      [...countsByUser.entries()].filter(([, count]) => count >= URGENT_THRESHOLD).map(([uid]) => uid)
    );
  }, [reports, now]);

  function updateFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const filteredReports = useMemo(() => {
    const nowMs = now.getTime();
    const dateThresholdMs =
      dateFilter === "today"
        ? 24 * 60 * 60 * 1000
        : dateFilter === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : dateFilter === "30d"
            ? 30 * 24 * 60 * 60 * 1000
            : null;

    return reports.filter((r) => {
      if (typeFilter !== "all" && r.target_type !== typeFilter) return false;
      if (statusFilter === "pending" && !(r.status === "open" || r.status === "reviewing"))
        return false;
      if (statusFilter === "resolved" && r.status !== "resolved") return false;
      if (statusFilter === "dismissed" && r.status !== "dismissed") return false;
      if (dateThresholdMs !== null && nowMs - new Date(r.created_at).getTime() > dateThresholdMs)
        return false;
      return true;
    });
  }, [reports, typeFilter, statusFilter, dateFilter, now]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const pageReports = filteredReports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function otherReportsFor(report: ReportWithTarget): ReportWithTarget[] {
    const uid = targetUserId(report);
    if (!uid) return [];
    return reports.filter((r) => r.id !== report.id && targetUserId(r) === uid);
  }

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
        logAdminAction(supabase, {
          adminId,
          actionType: "remove_message",
          targetType: "message",
          targetId: report.targetMessage.id,
        }).catch(() => {});
      } else {
        const uid = targetUserId(report);
        if (!uid) return;
        const status: ModerationStatus =
          kind === "suspend" ? "suspended" : kind === "ban" ? "banned" : "active";
        await setModerationStatus(supabase, uid, status);
        setReports((prev) =>
          prev.map((r) => (r.id === report.id ? { ...r, targetModerationStatus: status } : r))
        );
        logAdminAction(supabase, {
          adminId,
          actionType: kind,
          targetType: "profile",
          targetId: uid,
        }).catch(() => {});
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
      // Update in place (not remove) so the row moves into the Resolved/
      // Dismissed filter bucket instead of vanishing regardless of which
      // status filter is currently selected.
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status } : r)));
      setDetailReport((prev) => (prev?.id === reportId ? { ...prev, status } : prev));
      logAdminAction(supabase, {
        adminId,
        actionType: status === "resolved" ? "resolve_report" : "dismiss_report",
        targetType: "report",
        targetId: reportId,
      }).catch(() => {});
      setFeedback("success");
    } catch {
      setFeedback("error");
    } finally {
      setBusyReportId(null);
    }
  }

  function renderTargetBlock(report: ReportWithTarget) {
    const isNewAccount =
      !!report.targetCreatedAt &&
      now.getTime() - new Date(report.targetCreatedAt).getTime() < NEW_ACCOUNT_WINDOW_MS;

    if (report.target_type === "profile") {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-border p-3">
          <div
            className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
            style={
              !report.targetProfile?.avatar_url ? { backgroundImage: "var(--grad)" } : undefined
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
                {profileDisplayName(report.targetProfile, "?").charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-text">
              {t("targetTypeProfile")}:{" "}
              {profileDisplayName(report.targetProfile, tCommon("deletedUser"))}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              {report.targetModerationStatus && (
                <span className="text-xs text-muted">
                  {t(`statusBadge.${report.targetModerationStatus}`)}
                </span>
              )}
              {isNewAccount && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {t("newAccountBadge")}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (report.target_type === "message") {
      return (
        <div className="rounded-xl border border-border p-3">
          <p className="text-sm font-bold text-text">
            {t("targetTypeMessage")}:{" "}
            {profileDisplayName(report.targetMessage?.senderProfile, tCommon("deletedUser"))}
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
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {report.targetModerationStatus && (
              <span className="text-xs text-muted">
                {t(`statusBadge.${report.targetModerationStatus}`)}
              </span>
            )}
            {isNewAccount && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"
                style={{ backgroundImage: "var(--grad)" }}
              >
                {t("newAccountBadge")}
              </span>
            )}
          </div>
        </div>
      );
    }

    return <p className="text-sm italic text-muted">{t("targetTypeUnsupported")}</p>;
  }

  function renderActions(report: ReportWithTarget) {
    const suspendedOrBanned =
      report.targetModerationStatus === "suspended" || report.targetModerationStatus === "banned";
    const canModerate = targetUserId(report) !== null;
    const isPending = report.status === "open" || report.status === "reviewing";

    return (
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

        {isPending && (
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
        )}
      </div>
    );
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

      <div className="mb-4 flex flex-wrap gap-4 rounded-2xl border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("filters.typeLabel")}
          <select
            value={typeFilter}
            onChange={(e) => updateFilter<TypeFilter>(setTypeFilter)(e.target.value as TypeFilter)}
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="all">{t("filters.typeAll")}</option>
            <option value="profile">{t("filters.typeProfile")}</option>
            <option value="message">{t("filters.typeMessage")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("filters.statusLabel")}
          <select
            value={statusFilter}
            onChange={(e) =>
              updateFilter<StatusFilter>(setStatusFilter)(e.target.value as StatusFilter)
            }
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="pending">{t("filters.statusPending")}</option>
            <option value="resolved">{t("filters.statusResolved")}</option>
            <option value="dismissed">{t("filters.statusDismissed")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("filters.dateLabel")}
          <select
            value={dateFilter}
            onChange={(e) => updateFilter<DateFilter>(setDateFilter)(e.target.value as DateFilter)}
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="all">{t("filters.dateAll")}</option>
            <option value="today">{t("filters.dateToday")}</option>
            <option value="7d">{t("filters.date7d")}</option>
            <option value="30d">{t("filters.date30d")}</option>
          </select>
        </label>
      </div>

      {pageReports.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("noReports")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pageReports.map((report) => {
            const uid = targetUserId(report);
            const isUrgent = !!uid && urgentUserIds.has(uid);

            return (
              <div
                key={report.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>
                    {t("reporterLabel")}:{" "}
                    <span className="font-semibold text-text">
                      {profileDisplayName(report.reporterProfile, "—")}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    {isUrgent && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                        style={{ background: "#e55" }}
                      >
                        {t("urgentBadge")}
                      </span>
                    )}
                    {report.status === "reviewing" && (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ background: "var(--bg)", color: "var(--dark)" }}
                      >
                        {t("reviewingBadge")}
                      </span>
                    )}
                    <span>
                      {t("dateLabel")}: {new Date(report.created_at).toLocaleDateString(locale)}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-text">
                  <span className="font-bold">{t("reasonLabel")}:</span> {report.reason}
                </p>

                {renderTargetBlock(report)}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDetailReport(report)}
                    className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-text"
                  >
                    {t("viewAction")}
                  </button>
                  {renderActions(report)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filteredReports.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text disabled:opacity-40"
          >
            {t("pagination.prev")}
          </button>
          <span className="text-sm text-muted">
            {t("pagination.pageOf", { page, total: totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text disabled:opacity-40"
          >
            {t("pagination.next")}
          </button>
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

      <Modal
        open={!!detailReport}
        onClose={() => setDetailReport(null)}
        title={detailReport ? t("detail.title") : undefined}
      >
        {detailReport && (
          <div className="flex flex-col gap-4">
            {renderTargetBlock(detailReport)}
            <p className="text-sm text-text">
              <span className="font-bold">{t("reasonLabel")}:</span> {detailReport.reason}
            </p>

            <div>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                {t("detail.reportHistoryTitle")}
              </h3>
              {otherReportsFor(detailReport).length === 0 ? (
                <p className="text-sm text-muted">{t("detail.noOtherReports")}</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {otherReportsFor(detailReport).map((r) => (
                    <li key={r.id} className="text-sm text-text">
                      {new Date(r.created_at).toLocaleDateString(locale)} —{" "}
                      <span className="text-muted">{r.reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {renderActions(detailReport)}
          </div>
        )}
      </Modal>
    </div>
  );
}
