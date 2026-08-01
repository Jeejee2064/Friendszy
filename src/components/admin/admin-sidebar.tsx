"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const NAV_ITEMS = [
  { href: "/admin", key: "dashboard", icon: "📊" },
  { href: "/admin/moderation", key: "moderation", icon: "🛡️" },
  { href: "/admin/members", key: "members", icon: "👥" },
  { href: "/admin/logs", key: "logs", icon: "📋" },
] as const;

export function AdminSidebar({ pendingReportsCount }: { pendingReportsCount: number }) {
  const pathname = usePathname();
  const t = useTranslations("Admin.nav");

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-card p-4">
      {NAV_ITEMS.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
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
            {item.key === "moderation" && pendingReportsCount > 0 && (
              <span
                className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white"
                style={{ background: "#e55" }}
              >
                {pendingReportsCount}
              </span>
            )}
          </Link>
        );
      })}

      <span className="mt-1 flex cursor-not-allowed items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted opacity-50">
        <span className="text-base">📅</span>
        {t("events")}
        <span className="ml-auto rounded-full bg-bg px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
          {t("eventsSoon")}
        </span>
      </span>
    </nav>
  );
}
