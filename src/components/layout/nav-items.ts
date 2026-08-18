import { Home, Search, MessageCircle, Users, Compass, ShieldUser } from "lucide-react";
import { GroupIcon } from "@/components/icons/group-icon";

// Plain (non-"use client") module: single source of truth for the nav item
// list, shared by SidebarNav (renders it) and AppShell/NavTour (needs the
// key sequence to drive the guided tour). Kept out of sidebar-nav.tsx
// itself because that file is "use client" — plain functions exported from
// a client module can't be called from a Server Component (only rendered
// as a component), which is exactly what AppShell needs to do here.

export const NAV_ITEMS = [
  { href: "/", icon: Home, key: "home" },
  { href: "/search", icon: Search, key: "search" },
  { href: "/messages", icon: MessageCircle, key: "messages" },
  { href: "/friends", icon: Users, key: "friends" },
  { href: "/groups", icon: GroupIcon, key: "groups" },
  { href: "/discover", icon: Compass, key: "discover" },
] as const;

export const ADMIN_NAV_ITEM = { href: "/admin", icon: ShieldUser, key: "admin" } as const;

/**
 * The nav keys actually displayed, in display order — single source of
 * truth shared with NavTour so its step sequence can never drift from what
 * SidebarNav really renders (isAdmin included/excluded the same way here).
 */
export function getNavKeys(isAdmin: boolean): string[] {
  const items = isAdmin ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;
  return items.map((item) => item.key);
}

/** DOM id NavTour looks up to measure and highlight a given nav item. */
export function navTourTargetId(key: string) {
  return `nav-tour-target-${key}`;
}
