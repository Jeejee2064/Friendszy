"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AdminActionWithNames } from "@/lib/admin/queries";

function profileDisplayName(
  profile: { full_name: string | null; last_name: string | null } | null,
  deletedLabel: string
): string {
  return profile?.full_name
    ? [profile.full_name, profile.last_name].filter(Boolean).join(" ")
    : deletedLabel;
}

const ACTION_TYPE_KEYS: Record<string, string> = {
  suspend: "actions.suspend",
  ban: "actions.ban",
  reactivate: "actions.reactivate",
  remove_message: "actions.removeMessage",
  resolve_report: "actions.resolve",
  dismiss_report: "actions.dismiss",
};

export function AdminLogsClient({ actions }: { actions: AdminActionWithNames[] }) {
  const t = useTranslations("Admin.logs");
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  const [adminFilter, setAdminFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const admins = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of actions) {
      map.set(a.admin_id, profileDisplayName(a.adminProfile, tCommon("deletedUser")));
    }
    return [...map.entries()];
  }, [actions, tCommon]);

  const targets = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of actions) {
      if (a.target_type !== "profile") continue;
      map.set(a.target_id, profileDisplayName(a.targetProfile, tCommon("deletedUser")));
    }
    return [...map.entries()];
  }, [actions, tCommon]);

  const actionTypes = useMemo(
    () => [...new Set(actions.map((a) => a.action_type))],
    [actions]
  );

  const filtered = actions.filter((a) => {
    if (adminFilter !== "all" && a.admin_id !== adminFilter) return false;
    if (targetFilter !== "all" && a.target_id !== targetFilter) return false;
    if (actionFilter !== "all" && a.action_type !== actionFilter) return false;
    return true;
  });

  function targetLabel(a: AdminActionWithNames): string {
    if (a.target_type === "profile") return profileDisplayName(a.targetProfile, tCommon("deletedUser"));
    if (a.target_type === "message") return t("targetTypeMessage");
    if (a.target_type === "report") return t("targetTypeReport");
    return a.target_type;
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      <div className="mb-4 flex flex-wrap gap-4 rounded-2xl border border-border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("filterAdminLabel")}
          <select
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="all">{t("allAdmins")}</option>
            {admins.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("filterTargetLabel")}
          <select
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="all">{t("allTargets")}</option>
            {targets.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("filterActionLabel")}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="all">{t("allActions")}</option>
            {actionTypes.map((type) => (
              <option key={type} value={type}>
                {ACTION_TYPE_KEYS[type] ? tAdmin(ACTION_TYPE_KEYS[type]) : type}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("noActions")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4 text-sm"
            >
              <span className="font-bold text-text">
                {profileDisplayName(a.adminProfile, tCommon("deletedUser"))}
              </span>
              <span className="text-muted">
                {ACTION_TYPE_KEYS[a.action_type] ? tAdmin(ACTION_TYPE_KEYS[a.action_type]) : a.action_type}
              </span>
              <span className="text-text">{targetLabel(a)}</span>
              {a.reason && <span className="text-muted">— {a.reason}</span>}
              <span className="ml-auto text-xs text-muted">
                {new Date(a.created_at).toLocaleString(locale)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
