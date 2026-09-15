"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAdminAction } from "@/lib/admin/queries";
import { updateBetaFeedbackStatus } from "@/lib/beta-feedback/queries";
import type { BetaFeedbackWithProfile } from "@/lib/admin/types";
import type { FeedbackCategory, FeedbackStatus } from "@/lib/beta-feedback/types";
import { Notice } from "@/components/ui/notice";

const CATEGORY_LABEL_KEYS: Record<FeedbackCategory, "categoryBug" | "categoryIdea" | "categoryOther"> = {
  bug: "categoryBug",
  idea: "categoryIdea",
  other: "categoryOther",
};
const STATUS_LABEL_KEYS: Record<FeedbackStatus, "statusNew" | "statusRead" | "statusResolved"> = {
  new: "statusNew",
  read: "statusRead",
  resolved: "statusResolved",
};
const CATEGORIES = Object.keys(CATEGORY_LABEL_KEYS) as FeedbackCategory[];
const STATUSES = Object.keys(STATUS_LABEL_KEYS) as FeedbackStatus[];

function profileDisplayName(
  profile: { full_name: string | null; last_name: string | null } | null | undefined,
  deletedLabel: string
): string {
  return profile?.full_name
    ? [profile.full_name, profile.last_name].filter(Boolean).join(" ")
    : deletedLabel;
}

export function AdminBetaFeedbackClient({
  adminId,
  initialFeedback,
  initialScreenshotUrls,
}: {
  adminId: string;
  initialFeedback: BetaFeedbackWithProfile[];
  initialScreenshotUrls: Record<string, string>;
}) {
  const t = useTranslations("Admin.betaFeedback");
  // Shared top-level Admin keys, same ones every other admin feature reuses
  // for its own feedback Notice — a second translator instance rather than
  // duplicating those two strings here.
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [feedbackList, setFeedbackList] = useState<BetaFeedbackWithProfile[]>(initialFeedback);
  const [screenshotUrls] = useState<Record<string, string>>(initialScreenshotUrls);
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | "all">("all");
  const [notice, setNotice] = useState<"success" | "error" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredFeedback = useMemo(() => {
    return feedbackList.filter((f) => {
      if (statusFilter !== "all" && f.status !== statusFilter) return false;
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      return true;
    });
  }, [feedbackList, statusFilter, categoryFilter]);

  async function handleStatusChange(target: BetaFeedbackWithProfile, status: FeedbackStatus) {
    setBusyId(target.id);
    setNotice(null);
    try {
      const supabase = createClient();
      const updated = await updateBetaFeedbackStatus(supabase, target.id, status);
      setFeedbackList((prev) => prev.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)));
      logAdminAction(supabase, {
        adminId,
        actionType: "update_beta_feedback_status",
        targetType: "beta_feedback",
        targetId: target.id,
      }).catch(() => {});
      setNotice("success");
      // The sidebar's "new feedback" badge count is fetched server-side in
      // AdminLayout — refresh so it drops without a full navigation.
      router.refresh();
    } catch {
      setNotice("error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      {notice && (
        <Notice
          kind={notice}
          message={notice === "success" ? tAdmin("actionSuccess") : tAdmin("actionError")}
          className="mb-4 max-w-md"
        />
      )}

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">
            {t("filterStatusLabel")}
          </span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | "all")}
            className="rounded-lg border border-border px-3 py-2 text-sm normal-case text-text outline-none focus:border-teal2"
          >
            <option value="all">{t("allStatuses")}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(STATUS_LABEL_KEYS[status])}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-wide text-muted">
            {t("filterCategoryLabel")}
          </span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as FeedbackCategory | "all")}
            className="rounded-lg border border-border px-3 py-2 text-sm normal-case text-text outline-none focus:border-teal2"
          >
            <option value="all">{t("allCategories")}</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(CATEGORY_LABEL_KEYS[category])}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredFeedback.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("noFeedback")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredFeedback.map((f) => {
            const screenshotUrl = f.screenshot_path ? screenshotUrls[f.screenshot_path] : null;
            return (
              <div
                key={f.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row"
              >
                {screenshotUrl && (
                  <a
                    href={screenshotUrl}
                    target="_blank"
                    rel="noreferrer"
                    title={t("viewScreenshot")}
                    className="block h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={screenshotUrl} alt="" className="h-full w-full object-cover" />
                  </a>
                )}

                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>
                      {t("authorLabel")}:{" "}
                      <span className="font-semibold text-text">
                        {profileDisplayName(f.authorProfile, tCommon("deletedUser"))}
                      </span>
                    </span>
                    <span>{new Date(f.created_at).toLocaleString(locale)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                      style={{ backgroundImage: "var(--grad)" }}
                    >
                      {t(CATEGORY_LABEL_KEYS[f.category])}
                    </span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                      {t(STATUS_LABEL_KEYS[f.status])}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-sm text-text">{f.message}</p>

                  {f.page_url && (
                    <p className="truncate text-xs text-muted">
                      {t("pageLabel")}: {f.page_url}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {f.status === "new" && (
                      <button
                        type="button"
                        disabled={busyId === f.id}
                        onClick={() => handleStatusChange(f, "read")}
                        className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-muted disabled:opacity-60"
                      >
                        {t("markRead")}
                      </button>
                    )}
                    {f.status !== "resolved" && (
                      <button
                        type="button"
                        disabled={busyId === f.id}
                        onClick={() => handleStatusChange(f, "resolved")}
                        className="rounded-full px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                        style={{ backgroundImage: "var(--grad)" }}
                      >
                        {t("markResolved")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
