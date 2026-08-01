"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useUnreadNotificationsCount } from "@/lib/notifications/notifications-context";
import { useUnreadConversationsCount } from "@/lib/messages/unread-context";

const NAV_ITEMS = [
  { href: "/", icon: "🏠", key: "home" },
  { href: "/notifications", icon: "🔔", key: "notifications" },
  { href: "/search", icon: "🔍", key: "search" },
  { href: "/messages", icon: "💬", key: "messages" },
  { href: "/friends", icon: "👥", key: "friends" },
  { href: "/groups", icon: "🧑‍🤝‍🧑", key: "groups" },
  { href: "/partners", icon: "🤝", key: "partners" },
  { href: "/profile", icon: "👤", key: "profile" },
] as const;

// Custom icon (not an emoji) so Groups reads clearly as a group of friends
// rather than the 2-person "couple" look of the 🧑‍🤝‍🧑 emoji it replaces.
function GroupsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="7" r="2.6" />
      <path d="M7 19.5c0-3 2.2-5 5-5s5 2 5 5" />
      <circle cx="4.5" cy="9" r="2" />
      <path d="M1 19c0-2.3 1.5-3.9 3.5-3.9.9 0 1.7.3 2.4.9" />
      <circle cx="19.5" cy="9" r="2" />
      <path d="M23 19c0-2.3-1.5-3.9-3.5-3.9-.9 0-1.7.3-2.4.9" />
    </svg>
  );
}

const ADMIN_NAV_ITEM = { href: "/admin", icon: "🛡️", key: "admin" } as const;

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
        const badgeCount =
          item.key === "notifications"
            ? unreadNotifications
            : item.key === "messages"
              ? unreadConversations
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
              {item.key === "groups" ? <GroupsIcon /> : item.icon}
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
