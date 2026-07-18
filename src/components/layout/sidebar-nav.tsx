"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useUnreadNotificationsCount } from "@/lib/notifications/notifications-context";
import { useUnreadConversationsCount } from "@/lib/messages/unread-context";
import { usePendingRequestsCount } from "@/lib/friends/pending-context";

const NAV_ITEMS = [
  { href: "/", icon: "🏠", key: "home" },
  { href: "/notifications", icon: "🔔", key: "notifications" },
  { href: "/messages", icon: "💬", key: "messages" },
  { href: "/friends", icon: "👥", key: "friends" },
  { href: "/search", icon: "🔍", key: "search" },
  { href: "/profile", icon: "👤", key: "profile" },
] as const;

const ADMIN_NAV_ITEM = { href: "/admin", icon: "🛡️", key: "admin" } as const;

export function SidebarNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const unreadNotifications = useUnreadNotificationsCount();
  const unreadConversations = useUnreadConversationsCount();
  const pendingRequests = usePendingRequestsCount();
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) => {
        const active = pathname === item.href;
        const badgeCount =
          item.key === "notifications"
            ? unreadNotifications
            : item.key === "messages"
              ? unreadConversations
              : item.key === "friends"
                ? pendingRequests
                : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              active ? "bg-bg text-teal2" : "text-muted hover:bg-bg"
            }`}
          >
            <span className="relative text-lg">
              {item.icon}
              {badgeCount > 0 && (
                <span
                  className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {badgeCount}
                </span>
              )}
            </span>
            <span className="hidden md:inline">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
