"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const NAV_ITEMS = [
  { href: "/admin", key: "dashboard", icon: "📊" },
  { href: "/admin/analytics", key: "analytics", icon: "📈" },
  { href: "/admin/moderation", key: "moderation", icon: "🛡️" },
  { href: "/admin/members", key: "members", icon: "👥" },
  { href: "/admin/partners", key: "partners", icon: "🤝" },
  { href: "/admin/interest-suggestions", key: "interestSuggestions", icon: "💡" },
  { href: "/admin/logs", key: "logs", icon: "📋" },
] as const;

export function AdminSidebar({
  pendingReportsCount,
  pendingPartnersCount,
  pendingInterestSuggestionsCount,
}: {
  pendingReportsCount: number;
  pendingPartnersCount: number;
  pendingInterestSuggestionsCount: number;
}) {
  const pathname = usePathname();
  const t = useTranslations("Admin.nav");

  const badgeCountByKey: Partial<Record<(typeof NAV_ITEMS)[number]["key"], number>> = {
    moderation: pendingReportsCount,
    partners: pendingPartnersCount,
    interestSuggestions: pendingInterestSuggestionsCount,
  };

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-card p-4">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const badgeCount = badgeCountByKey[item.key] ?? 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              active ? "bg-bg text-teal2" : "text-muted hover:bg-bg"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {t(item.key)}
            {badgeCount > 0 && (
              <span
                className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white"
                style={{ background: "#e55" }}
              >
                {badgeCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
