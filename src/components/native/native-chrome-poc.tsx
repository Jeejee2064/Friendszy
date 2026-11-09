"use client";

// POC (Phase 2, GATE) — 2 onglets natifs + barre du haut. Sans effet sur le web :
// tout est conditionné par Capacitor.isNativePlatform(). À remplacer par
// l'implémentation complète si la GATE est validée.

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { usePathname, useRouter } from "@/i18n/navigation";

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const ICONS = {
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
};

export function NativeChromePoc() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const { NativeNavigation } = await import("@capgo/native-navigation");
      if (cancelled) return;
      await NativeNavigation.configure({ contentInsetMode: "css" });
      await NativeNavigation.setNavbar({
        title: "Friendszy",
        backButton: { visible: false },
        rightItems: [
          { id: "notifications", title: "Notifications", icon: { svg: ICONS.bell } },
          { id: "profile", title: "Profil", icon: { svg: ICONS.user } },
        ],
      });
      const navItem = await NativeNavigation.addListener("navbarItemTap", ({ id }) => {
        router.push(id === "profile" ? "/profile" : "/notifications");
      });
      const tab = await NativeNavigation.addListener("tabSelect", ({ id }) => {
        router.push(id === "search" ? "/search" : "/");
      });
      off = () => {
        navItem.remove();
        tab.remove();
      };
    })();
    return () => {
      cancelled = true;
      off?.();
    };
  }, [router]);

  // Onglet actif synchronisé avec la route Next.js.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    (async () => {
      const { NativeNavigation } = await import("@capgo/native-navigation");
      await NativeNavigation.setTabbar({
        selectedId: pathname.startsWith("/search") ? "search" : "home",
        labels: true,
        icons: true,
        tabs: [
          { id: "home", title: "Accueil", icon: { svg: ICONS.home } },
          { id: "search", title: "Recherche", icon: { svg: ICONS.search } },
        ],
      });
    })();
  }, [pathname]);

  return null;
}
