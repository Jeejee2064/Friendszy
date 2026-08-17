"use client";

import { useTranslations } from "next-intl";
import { Home, Search, MessageCircle, Users, Compass, ShieldUser } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useUnreadNotificationsCount } from "@/lib/notifications/notifications-context";
import { useUnreadConversationsCount } from "@/lib/messages/unread-context";
import { GroupIcon } from "@/components/icons/group-icon";

const NAV_ITEMS = [
  { href: "/", icon: Home, key: "home" },
  { href: "/search", icon: Search, key: "search" },
  { href: "/messages", icon: MessageCircle, key: "messages" },
  { href: "/friends", icon: Users, key: "friends" },
  { href: "/groups", icon: GroupIcon, key: "groups" },
  { href: "/discover", icon: Compass, key: "discover" },
] as const;

const ADMIN_NAV_ITEM = { href: "/admin", icon: ShieldUser, key: "admin" } as const;

export function SidebarNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const unreadNotifications = useUnreadNotificationsCount();
  const unreadConversations = useUnreadConversationsCount();
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <nav className="flex flex-col gap-1 px-2">
      {items.map((item) => {
        // Groups has nested routes (/groups/[id], /groups/new, ...) that
        // still belong to the same nav entry, unlike every other item here.
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
        // The bell/profile tabs were removed (dashboard's own notifications
        // preview + the avatar link in AppShell already cover both) — the
        // unread-notifications badge moved here, onto Home, so it isn't
        // lost.
        const badgeCount =
          item.key === "home"
            ? unreadNotifications
            : item.key === "messages"
              ? unreadConversations
              : 0;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              active ? "bg-bg text-teal2" : "text-muted hover:bg-bg"
            }`}
          >
            <span className="relative flex h-[18px] w-[18px] items-center justify-center">
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              {badgeCount > 0 && (
                <span
                  className="absolute -right-2.5 -top-2.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
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
