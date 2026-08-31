"use client";

import { useTranslations } from "next-intl";
import type { AnalyticsKpis } from "@/lib/admin/analytics-queries";

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} j`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-bold text-text">{title}</h2>
      {children}
    </div>
  );
}

function FunnelStep({
  label,
  count,
  baseline,
}: {
  label: string;
  count: number;
  baseline: number;
}) {
  const percent = pct(count, baseline) ?? (count > 0 ? 100 : 0);
  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold text-text">
        <span>{label}</span>
        <span className="text-muted">
          {count} · {percent}%
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-bg">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, percent)}%`, backgroundImage: "var(--grad)" }}
        />
      </div>
    </div>
  );
}

function TwoRowBars({
  rows,
}: {
  rows: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-muted">{r.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-bg">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, backgroundImage: "var(--grad)" }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-bold text-text">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-text">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function AdminAnalyticsClient({ kpis }: { kpis: AnalyticsKpis }) {
  const t = useTranslations("Admin.analytics");

  const reciprocityPercent = pct(kpis.friendReciprocity.mutualAdds, kpis.friendReciprocity.totalAdds);
  const contactSafetyPercent = pct(kpis.contactSafety.blockedOrReported, kpis.contactSafety.newContacts);
  const zeroResultPercent = pct(kpis.search.zeroResultCount, kpis.search.zeroResultTotal);

  return (
    <div className="p-6 md:p-10">
      <div className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-extrabold text-text">{t("title")}</h1>
        <span className="text-xs text-muted">{t("periodLabel")}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t("funnelTitle")}>
          <FunnelStep
            label={t("funnelStarted")}
            count={kpis.funnel.startedSignup}
            baseline={kpis.funnel.startedSignup}
          />
          <FunnelStep
            label={t("funnelConfirmed")}
            count={kpis.funnel.confirmedEmail}
            baseline={kpis.funnel.startedSignup}
          />
          <FunnelStep
            label={t("funnelCompleted")}
            count={kpis.funnel.completedProfile}
            baseline={kpis.funnel.startedSignup}
          />
          {kpis.onboardingStepDropoff.length > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs font-bold text-muted">{t("stepDropoffTitle")}</p>
              <TwoRowBars
                rows={kpis.onboardingStepDropoff.map((s) => ({
                  label: s.stepName,
                  value: s.count,
                }))}
              />
            </div>
          )}
        </Section>

        <Section title={t("retentionTitle")}>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-muted">{t("retentionD1")}</p>
              <p className="text-2xl font-extrabold text-text">
                {kpis.retention.d1 === null ? "—" : `${kpis.retention.d1}%`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">{t("retentionD7")}</p>
              <p className="text-2xl font-extrabold text-text">
                {kpis.retention.d7 === null ? "—" : `${kpis.retention.d7}%`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">{t("retentionD30")}</p>
              <p className="text-2xl font-extrabold text-text">
                {kpis.retention.d30 === null ? "—" : `${kpis.retention.d30}%`}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            {kpis.retention.cohortSize > 0
              ? t("retentionCohortNote", { count: kpis.retention.cohortSize })
              : t("retentionUnavailable")}
          </p>
        </Section>

        <Section title={t("searchTitle")}>
          <TwoRowBars
            rows={[
              {
                label: t("searchByName"),
                value: kpis.search.byMode.find((m) => m.mode === "name")?.count ?? 0,
              },
              {
                label: t("searchByInterest"),
                value: kpis.search.byMode.find((m) => m.mode === "discover")?.count ?? 0,
              },
            ]}
          />
          {zeroResultPercent !== null && (
            <p className="mt-3 text-xs text-muted">
              {t("searchZeroResultTitle")} : {zeroResultPercent}% ({kpis.search.zeroResultCount} /{" "}
              {kpis.search.zeroResultTotal})
            </p>
          )}
          {kpis.search.zeroResultCities.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 text-xs font-bold text-muted">{t("searchZeroResultCitiesTitle")}</p>
              <TwoRowBars
                rows={kpis.search.zeroResultCities.map((c) => ({ label: c.city, value: c.count }))}
              />
            </div>
          )}
          {kpis.search.actionsByMode.length > 0 && (
            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-2 text-xs font-bold text-muted">{t("searchConversionTitle")}</p>
              <TwoRowBars
                rows={kpis.search.actionsByMode.map((m) => ({
                  label: m.mode === "name" ? t("searchByName") : t("searchByInterest"),
                  value: m.actions,
                }))}
              />
            </div>
          )}
        </Section>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Section title={t("groupsTitle")}>
            <TwoRowBars
              rows={[
                { label: t("createdLabel"), value: kpis.groups.created },
                { label: t("activeLabel"), value: kpis.groups.active },
              ]}
            />
          </Section>
          <Section title={t("eventsTitle")}>
            <TwoRowBars
              rows={[
                { label: t("createdLabel"), value: kpis.events.created },
                { label: t("activeLabel"), value: kpis.events.active },
              ]}
            />
          </Section>
        </div>

        <Section title={t("notificationsTitle")}>
          <TwoRowBars
            rows={[
              { label: t("receivedLabel"), value: kpis.notifications.received },
              { label: t("clickedLabel"), value: kpis.notifications.clicked },
            ]}
          />
        </Section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("reciprocityTitle")}
          value={reciprocityPercent === null ? "—" : `${reciprocityPercent}%`}
          sub={
            kpis.friendReciprocity.totalAdds > 0
              ? t("reciprocityBody", {
                  percent: reciprocityPercent ?? 0,
                  mutual: kpis.friendReciprocity.mutualAdds,
                  total: kpis.friendReciprocity.totalAdds,
                })
              : undefined
          }
        />
        <StatCard
          label={t("firstMessageTitle")}
          value={
            kpis.timeToFirstMessage.medianHours === null
              ? "—"
              : formatHours(kpis.timeToFirstMessage.medianHours)
          }
          sub={
            kpis.timeToFirstMessage.friendshipsWithMessage +
              kpis.timeToFirstMessage.friendshipsWithoutMessage >
            0
              ? t("firstMessageSplit", {
                  withMessage: kpis.timeToFirstMessage.friendshipsWithMessage,
                  withoutMessage: kpis.timeToFirstMessage.friendshipsWithoutMessage,
                })
              : t("firstMessageUnavailable")
          }
        />
        <StatCard
          label={t("contactSafetyTitle")}
          value={contactSafetyPercent === null ? "—" : `${contactSafetyPercent}%`}
          sub={
            kpis.contactSafety.newContacts > 0
              ? t("contactSafetyBody", {
                  percent: contactSafetyPercent ?? 0,
                  total: kpis.contactSafety.newContacts,
                })
              : undefined
          }
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section title={t("pwaTitle")}>
          <TwoRowBars
            rows={[
              { label: t("pwaPromptAccepted"), value: kpis.pwa.promptAccepted },
              { label: t("pwaPromptDismissed"), value: kpis.pwa.promptDismissed },
              { label: t("pwaInstalled"), value: kpis.pwa.installed },
            ]}
          />
        </Section>
        <Section title={t("pushTitle")}>
          <TwoRowBars
            rows={[
              { label: t("pushGranted"), value: kpis.push.granted },
              { label: t("pushDenied"), value: kpis.push.denied },
              { label: t("pushDefault"), value: kpis.push.default },
            ]}
          />
        </Section>
      </div>
    </div>
  );
}
