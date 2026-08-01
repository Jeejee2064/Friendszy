"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  listMembers,
  getReportCountsByUser,
  getMessageCountsByUser,
  getFriendCountsByUser,
  getMemberDetail,
  type MemberRow,
  type MemberFilters,
  type MemberDetail,
} from "@/lib/admin/members-queries";
import { setModerationStatus, logAdminAction } from "@/lib/admin/queries";
import type { ModerationStatus } from "@/lib/admin/types";
import { Modal } from "@/components/ui/modal";
import { Notice } from "@/components/ui/notice";

const PAGE_SIZE = 10;

function displayName(m: MemberRow, deletedLabel: string): string {
  return m.full_name ? [m.full_name, m.last_name].filter(Boolean).join(" ") : deletedLabel;
}

export function AdminMembersClient({
  initialMembers,
  cities,
  adminId,
}: {
  initialMembers: MemberRow[];
  cities: string[];
  adminId: string;
}) {
  const t = useTranslations("Admin.members");
  const tAdmin = useTranslations("Admin");
  const tCommon = useTranslations("Common");
  const locale = useLocale();

  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [registeredWithin, setRegisteredWithin] = useState<MemberFilters["registeredWithin"]>("all");
  const [status, setStatus] = useState<ModerationStatus | "all">("all");
  const [reportsFilter, setReportsFilter] = useState<"all" | "0" | "1-2" | "3+">("all");
  const [page, setPage] = useState(1);

  const [reportCounts, setReportCounts] = useState<Map<string, number>>(new Map());
  const [messageCounts, setMessageCounts] = useState<Map<string, number>>(new Map());
  const [friendCounts, setFriendCounts] = useState<Map<string, number> | null>(new Map());

  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<"success" | "error" | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoading(true);
      const supabase = createClient();
      listMembers(supabase, {
        search: search || undefined,
        city: city || undefined,
        registeredWithin,
        status,
      })
        .then(setMembers)
        .finally(() => setLoading(false));
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [search, city, registeredWithin, status]);

  useEffect(() => {
    const supabase = createClient();
    const ids = members.map((m) => m.id);
    getReportCountsByUser(supabase).then(setReportCounts);
    getMessageCountsByUser(supabase, ids).then(setMessageCounts);
    getFriendCountsByUser(supabase, ids).then(setFriendCounts);
  }, [members]);

  const filteredMembers = useMemo(() => {
    if (reportsFilter === "all") return members;
    return members.filter((m) => {
      const count = reportCounts.get(m.id) ?? 0;
      if (reportsFilter === "0") return count === 0;
      if (reportsFilter === "1-2") return count >= 1 && count <= 2;
      return count >= 3;
    });
  }, [members, reportsFilter, reportCounts]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
  const pageMembers = filteredMembers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function openDetail(member: MemberRow) {
    setDetailMember(member);
    setDetail(null);
    const supabase = createClient();
    const d = await getMemberDetail(supabase, member.id);
    setDetail(d);
  }

  async function handleBan(member: MemberRow) {
    setFeedback(null);
    try {
      const supabase = createClient();
      const nextStatus: ModerationStatus =
        member.moderation_status === "banned" ? "active" : "banned";
      await setModerationStatus(supabase, member.id, nextStatus);
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, moderation_status: nextStatus } : m))
      );
      logAdminAction(supabase, {
        adminId,
        actionType: nextStatus === "banned" ? "ban" : "reactivate",
        targetType: "profile",
        targetId: member.id,
      }).catch(() => {});
      setFeedback("success");
    } catch {
      setFeedback("error");
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (city) params.set("city", city);
      if (registeredWithin) params.set("registeredWithin", registeredWithin);
      if (status) params.set("status", status);
      const response = await fetch(`/api/admin/members/export?${params.toString()}`);
      if (!response.ok) throw new Error("export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `friendszy-membres-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setFeedback("error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-text">{t("title")}</h1>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {exporting ? t("exporting") : t("exportButton")}
        </button>
      </div>

      {feedback && (
        <Notice
          kind={feedback}
          message={feedback === "success" ? tAdmin("actionSuccess") : tAdmin("actionError")}
          className="mb-4 max-w-md"
        />
      )}

      <div className="mb-4 flex flex-wrap gap-4 rounded-2xl border border-border bg-card p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="min-w-[200px] flex-1 rounded-lg border border-border px-3 py-2 text-sm outline-none focus:border-teal2"
        />

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("cityLabel")}
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="">{t("cityAll")}</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("registeredLabel")}
          <select
            value={registeredWithin}
            onChange={(e) =>
              setRegisteredWithin(e.target.value as MemberFilters["registeredWithin"])
            }
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="all">{t("registeredAll")}</option>
            <option value="7d">{t("registered7d")}</option>
            <option value="30d">{t("registered30d")}</option>
            <option value="90d">{t("registered90d")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("statusLabel")}
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ModerationStatus | "all")}
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="all">{t("statusAll")}</option>
            <option value="active">{tAdmin("statusBadge.active")}</option>
            <option value="suspended">{tAdmin("statusBadge.suspended")}</option>
            <option value="banned">{tAdmin("statusBadge.banned")}</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wide text-muted">
          {t("reportsLabel")}
          <select
            value={reportsFilter}
            onChange={(e) => {
              setReportsFilter(e.target.value as typeof reportsFilter);
              setPage(1);
            }}
            className="rounded-lg border border-border px-2 py-1.5 text-sm font-normal normal-case text-text"
          >
            <option value="all">{t("reportsAll")}</option>
            <option value="0">{t("reports0")}</option>
            <option value="1-2">{t("reports1to2")}</option>
            <option value="3+">{t("reports3plus")}</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="text-center text-sm text-muted">{tAdmin("loading")}</p>
      ) : pageMembers.length === 0 ? (
        <p className="text-center text-sm text-muted">{t("noMembers")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {/* Column header — desktop only, mirrors each row's grid so values line up underneath.
              Sticky so it stays visible while scrolling a long member list. */}
          <div className="sticky top-0 z-10 hidden gap-4 border-b border-border bg-bg px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted md:grid md:grid-cols-[minmax(180px,1.3fr)_60px_100px_90px_80px_100px_140px]">
            <span>{t("columnMember")}</span>
            <span className="text-right">{t("columnAge")}</span>
            <span>{t("columnRegistered")}</span>
            <span className="text-right">{t("columnReports")}</span>
            <span className="text-right">{t("columnFriends")}</span>
            <span>{t("columnStatus")}</span>
            <span />
          </div>

          {pageMembers.map((m) => (
            <div
              key={m.id}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:grid md:grid-cols-[minmax(180px,1.3fr)_60px_100px_90px_80px_100px_140px] md:items-center md:gap-4"
            >
              <Link href={`/profile/${m.id}`} className="flex min-w-0 items-center gap-3">
                <div
                  className="h-10 w-10 shrink-0 overflow-hidden rounded-full"
                  style={!m.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
                >
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-white">
                      {displayName(m, "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text hover:underline">
                    {displayName(m, tCommon("deletedUser"))}
                  </p>
                  <p className="truncate text-xs text-muted">{m.city ?? "—"}</p>
                </div>
              </Link>

              {/* Mobile: compact labeled chips. Desktop: plain values aligned under the header. */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted md:contents md:text-sm md:text-text">
                <span className="md:text-right">
                  <span className="md:hidden">{t("columnAge")}: </span>
                  {m.age ?? "—"}
                </span>
                <span>
                  <span className="md:hidden">{t("columnRegistered")}: </span>
                  {new Date(m.created_at).toLocaleDateString(locale)}
                </span>
                <span className="md:text-right">
                  <span className="md:hidden">{t("columnReports")}: </span>
                  {reportCounts.get(m.id) ?? 0}
                </span>
                <span className="md:text-right">
                  <span className="md:hidden">{t("columnFriends")}: </span>
                  {friendCounts?.get(m.id) ?? t("rlsPendingNotice")}
                </span>
              </div>

              <span className="text-xs font-semibold text-muted md:text-sm">
                {tAdmin(`statusBadge.${m.moderation_status}`)}
              </span>

              <div className="flex gap-2 md:justify-end">
                <button
                  type="button"
                  onClick={() => openDetail(m)}
                  className="rounded-full border border-border px-3 py-2 text-xs font-semibold text-text"
                >
                  {tAdmin("viewAction")}
                </button>
                <button
                  type="button"
                  onClick={() => handleBan(m)}
                  className="rounded-full px-3 py-2 text-xs font-bold text-white"
                  style={{
                    background: m.moderation_status === "banned" ? "var(--teal2)" : "#e55",
                  }}
                >
                  {tAdmin(m.moderation_status === "banned" ? "actions.reactivate" : "actions.ban")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredMembers.length > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text disabled:opacity-40"
          >
            {tAdmin("pagination.prev")}
          </button>
          <span className="text-sm text-muted">
            {tAdmin("pagination.pageOf", { page, total: totalPages })}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-text disabled:opacity-40"
          >
            {tAdmin("pagination.next")}
          </button>
        </div>
      )}

      <Modal
        open={!!detailMember}
        onClose={() => setDetailMember(null)}
        title={detailMember ? t("detailTitle") : undefined}
      >
        {detailMember && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div
                className="h-14 w-14 shrink-0 overflow-hidden rounded-full"
                style={!detailMember.avatar_url ? { backgroundImage: "var(--grad)" } : undefined}
              >
                {detailMember.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detailMember.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-bold text-white">
                    {displayName(detailMember, "?").charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="font-bold text-text">
                  {displayName(detailMember, tCommon("deletedUser"))}
                </p>
                <p className="text-sm text-muted">
                  {detailMember.city ?? "—"} · {detailMember.age ?? "—"}
                </p>
              </div>
            </div>

            {!detail ? (
              <p className="text-sm text-muted">{tAdmin("loading")}</p>
            ) : (
              <>
                {detail.bio && (
                  <div>
                    <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                      {t("bioLabel")}
                    </h3>
                    <p className="text-sm text-text">{detail.bio}</p>
                  </div>
                )}

                {detail.interests.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                      {t("interestsLabel")}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.interests.map((i) => (
                        <span
                          key={i.id}
                          className="rounded-full border border-border px-2.5 py-1 text-xs"
                        >
                          {i.emoji ? `${i.emoji} ` : ""}
                          {locale === "en" ? i.label_en : i.label_fr}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                    {t("friendsLabel")}
                  </h3>
                  {detail.friends === null ? (
                    <p className="text-sm text-muted">{t("rlsPendingNotice")}</p>
                  ) : detail.friends.length === 0 ? (
                    <p className="text-sm text-muted">—</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {detail.friends.map((f) => (
                        <Link
                          key={f.id}
                          href={`/profile/${f.id}`}
                          className="text-sm text-teal2 hover:underline"
                        >
                          {displayName(f as MemberRow, tCommon("deletedUser"))}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                    {t("groupsLabel")}
                  </h3>
                  {detail.groups === null ? (
                    <p className="text-sm text-muted">{t("rlsPendingNotice")}</p>
                  ) : detail.groups.length === 0 ? (
                    <p className="text-sm text-muted">—</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {detail.groups.map((g) => (
                        <Link
                          key={g.id}
                          href={`/groups/${g.id}`}
                          className="text-sm text-teal2 hover:underline"
                        >
                          {g.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-sm text-text">
                  <span>
                    {t("lastSeenLabel")}:{" "}
                    {detailMember.last_seen_at
                      ? new Date(detailMember.last_seen_at).toLocaleDateString(locale)
                      : t("never")}
                  </span>
                  <span>
                    {t("messagesSentLabel")}: {messageCounts.get(detailMember.id) ?? 0}
                  </span>
                </div>

                <div>
                  <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                    {t("reportsReceivedLabel")}
                  </h3>
                  {detail.reportsReceived.length === 0 ? (
                    <p className="text-sm text-muted">{t("noReportsReceived")}</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {detail.reportsReceived.map((r) => (
                        <li key={r.id} className="text-sm text-text">
                          {new Date(r.created_at).toLocaleDateString(locale)} —{" "}
                          <span className="text-muted">{r.reason}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleBan(detailMember)}
                  className="rounded-full px-4 py-2.5 text-sm font-bold text-white"
                  style={{
                    background:
                      detailMember.moderation_status === "banned" ? "var(--teal2)" : "#e55",
                  }}
                >
                  {tAdmin(
                    detailMember.moderation_status === "banned"
                      ? "actions.reactivate"
                      : "actions.ban"
                  )}
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
