import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/profile/queries";
import { getDashboardStats } from "@/lib/dashboard/queries";
import { getNotificationsWithProfiles } from "@/lib/notifications/queries";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationRow } from "@/components/notifications/notification-row";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");
  const tNav = await getTranslations("Nav");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profile, stats, notifications] = await Promise.all([
    getMyProfile(supabase, user.id),
    getDashboardStats(supabase, user.id),
    getNotificationsWithProfiles(supabase, user.id, 5),
  ]);

  const firstName = profile?.full_name ?? "";

  return (
    <div className="flex flex-col">
      <PageHeader title={tNav("home")} />

      <div className="p-6 md:p-10">
        <div
          className="relative mb-6 overflow-hidden rounded-2xl p-6 text-white"
          style={{ backgroundImage: "var(--grad)" }}
        >
          <p className="text-xl font-bold">{t("welcomeBack", { name: firstName })}</p>
          <span className="pointer-events-none absolute -right-2 -top-2 text-6xl opacity-30">
            👋
          </span>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatTile value={stats.friendsCount} label={t("stats.friends")} />
          <StatTile value={stats.unreadCount} label={t("stats.unread")} />
          <StatTile value={stats.myInterestsCount} label={t("stats.interests")} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
              {t("quickAccess")}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <QuickAccessCard
                href="/search"
                icon="🔍"
                iconBg="var(--blue)"
                title={t("cards.searchTitle")}
                subtitle={t("cards.searchSubtitle")}
              />
              <QuickAccessCard
                href="/messages"
                icon="💬"
                iconBg="var(--teal1)"
                title={t("cards.messagesTitle")}
                subtitle={t("cards.messagesSubtitle", { count: stats.unreadCount })}
              />
              <QuickAccessCard
                href="/friends"
                icon="👥"
                iconBg="var(--teal2)"
                title={t("cards.friendsTitle")}
                subtitle={t("cards.friendsSubtitle", { count: stats.friendsCount })}
              />
              <QuickAccessCard
                href="/profile"
                icon="✏️"
                iconBg="#f59e0b"
                title={t("cards.profileTitle")}
                subtitle={t("cards.profileSubtitle")}
              />
            </div>
          </div>

          {notifications.length > 0 && (
            <div className="lg:col-span-1">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
                ⚡ {t("recentActivity")}
              </p>
              <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-3">
                {notifications.map((n) => (
                  <NotificationRow key={n.id} notification={n} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-2xl font-extrabold text-teal2">{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

function QuickAccessCard({
  href,
  icon,
  iconBg,
  title,
  subtitle,
}: {
  href: "/search" | "/messages" | "/friends" | "/profile";
  icon: ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-teal2"
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg"
        style={{ backgroundColor: iconBg }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate font-bold text-text">{title}</p>
        <p className="truncate text-sm text-muted">{subtitle}</p>
      </div>
    </Link>
  );
}
