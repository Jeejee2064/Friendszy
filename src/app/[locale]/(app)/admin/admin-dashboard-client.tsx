"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { DashboardKpis } from "@/lib/admin/dashboard-queries";
import type { ReportWithTarget } from "@/lib/admin/types";

function variationLabel(current: number, previous: number): string | null {
  if (previous === 0) return current > 0 ? "+100%" : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function KpiCard({
  label,
  value,
  badge,
  variation,
  unavailable,
  unavailableLabel,
}: {
  label: string;
  value: number | null;
  badge?: string;
  variation?: string | null;
  unavailable?: boolean;
  unavailableLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      {unavailable ? (
        <p className="mt-2 text-xs italic text-muted">{unavailableLabel}</p>
      ) : (
        <div className="mt-1 flex items-end gap-2">
          <p className="text-3xl font-extrabold text-text">{value}</p>
          {variation && (
            <span
              className={`mb-1 text-xs font-bold ${
                variation.startsWith("+") ? "text-teal2" : "text-[#e55]"
              }`}
            >
              {variation}
            </span>
          )}
        </div>
      )}
      {badge && (
        <span
          className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

function SignupsChart({ data }: { data: { date: string; count: number }[] }) {
  const width = 600;
  const height = 160;
  const padding = 8;
  const max = Math.max(1, ...data.map((d) => d.count));
  const stepX = (width - padding * 2) / Math.max(1, data.length - 1);

  const points = data
    .map((d, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (d.count / max) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--teal2)" strokeWidth="2" />
    </svg>
  );
}

function TopCitiesChart({ data }: { data: { city: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => (
        <div key={d.city} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-xs text-muted">{d.city}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-bg">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.count / max) * 100}%`, backgroundImage: "var(--grad)" }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-xs font-bold text-text">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

export function AdminDashboardClient({
  kpis,
  recentReports,
}: {
  kpis: DashboardKpis;
  recentReports: ReportWithTarget[];
}) {
  const t = useTranslations("Admin.dashboard");
  const tCommon = useTranslations("Common");

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label={t("totalMembers")}
          value={kpis.totalMembers}
          badge={kpis.newMembersLast24h > 0 ? t("newBadge", { count: kpis.newMembersLast24h }) : undefined}
        />
        <KpiCard
          label={t("newMembersThisMonth")}
          value={kpis.newMembersThisMonth}
          variation={variationLabel(kpis.newMembersThisMonth, kpis.newMembersPrevMonth)}
        />
        <KpiCard label={t("messagesToday")} value={kpis.messagesToday} />
        <KpiCard label={t("reportsPending")} value={kpis.reportsPending} />
        <KpiCard
          label={t("activeGroupChats")}
          value={kpis.activeGroupChats}
          unavailable={kpis.activeGroupChats === null}
          unavailableLabel={t("rlsPendingNotice")}
        />
        <KpiCard
          label={t("friendsThisWeek")}
          value={kpis.friendsThisWeek}
          unavailable={kpis.friendsThisWeek === null}
          unavailableLabel={t("rlsPendingNotice")}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-bold text-text">{t("signupsChartTitle")}</h2>
          <SignupsChart data={kpis.signupsLast30Days} />
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-bold text-text">{t("topCitiesChartTitle")}</h2>
          {kpis.topCities.length === 0 ? (
            <p className="text-sm text-muted">{tCommon("deletedUser")}</p>
          ) : (
            <TopCitiesChart data={kpis.topCities} />
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-bold text-text">{t("recentReportsTitle")}</h2>
        {recentReports.length === 0 ? (
          <p className="text-sm text-muted">{t("noPendingReports")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {recentReports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{report.reason}</p>
                  <p className="text-xs text-muted">
                    {new Date(report.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Link
                  href="/admin/moderation"
                  className="shrink-0 rounded-full border border-teal2 px-3 py-1.5 text-xs font-bold text-teal2"
                >
                  {t("moderateLink")}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
