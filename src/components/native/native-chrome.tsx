"use client";

// Barre d'onglets + barre du haut natives (Phase 2). Inerte hors app native :
// le web et la PWA gardent leur sidebar HTML. Onglets (5 max imposé par les
// plateformes) : Accueil, Recherche, Découvrir, Messages, Groupes. En haut :
// Notifications (point si non lues) et Profil. Amis, Admin, langue : voir
// NativeProfileLinks.

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useUnreadNotificationsCount } from "@/lib/notifications/notification-center";
import { useUnreadConversationsCount } from "@/lib/notifications/notification-center";
import { useActiveConversationId } from "@/lib/messages/active-conversation-context";
import { Capacitor } from "@capacitor/core";
import { isNativeApp } from "@/lib/native/is-native-app";

type Insets = { top: number; bottom: number } | undefined;

// BUG @capgo/native-navigation 8.0.8 (Android) : les marges sont calculées en
// pixels d'écran puis écrites telles quelles comme "px" CSS (--cap-native-*),
// donc ×densité trop grandes (≈2,6× sur un écran xxhdpi). On recalcule ici dans
// nos propres variables (--native-top/-bottom), utilisées par globals.css. iOS
// renvoie déjà des points = px CSS. À retirer si le plugin corrige le bug.
function applyInsets(insets: Insets) {
  if (!insets) return;
  const k = Capacitor.getPlatform() === "android" ? window.devicePixelRatio || 1 : 1;
  const root = document.documentElement.style;
  root.setProperty("--native-top", `${Math.round(insets.top / k)}px`);
  root.setProperty("--native-bottom", `${Math.round(insets.bottom / k)}px`);
}

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

// Mêmes pictogrammes lucide que la nav web (nav-items.ts).
const ICONS = {
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  discover: svg('<circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.3 2.1 2.1-6.3z"/>'),
  messages: svg('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
  groups: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17.5 14.5a5 5 0 0 1 4 5"/>'),
  bell: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'),
  // Le plugin n'a pas de badge sur la barre du haut : un point plein signale les non lues.
  bellDot: svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><circle cx="19" cy="5" r="3.2" fill="currentColor"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
};

type TabId = "home" | "search" | "discover" | "messages" | "groups";

const TAB_ROUTES: Record<TabId, string> = {
  home: "/",
  search: "/search",
  discover: "/discover",
  messages: "/messages",
  groups: "/groups",
};

// Route courante → onglet actif (null = page hors onglets : profil, notifications, amis…).
function activeTab(pathname: string): TabId | null {
  if (pathname === "/") return "home";
  const starts = (p: string) => pathname === p || pathname.startsWith(`${p}/`);
  if (starts("/search") || starts("/partners")) return "search";
  if (starts("/discover") || starts("/events")) return "discover";
  if (starts("/messages")) return "messages";
  if (starts("/groups")) return "groups";
  return null;
}

const ROOT_PATHS = new Set(Object.values(TAB_ROUTES));

// Chat de groupe plein écran (/groups/<id>, pas /groups/new ni les sous-pages).
const GROUP_CHAT_RE = /^\/groups\/(?!new(\/|$))[^/]+\/?$/;

type BarsState = {
  hidden: boolean;
  // Clavier ouvert : seule la barre d'onglets est masquée (la WebView se redimensionne
  // et la barre native remontait par-dessus le champ et ses suggestions).
  tabbarHidden: boolean;
  active: TabId | null;
  unreadMessages: number;
  unreadNotifications: number;
  labels: Record<"home" | "search" | "discover" | "messages" | "groups" | "notifications" | "profile", string>;
};

async function applyBars(state: BarsState) {
  const { NativeNavigation } = await import("@capgo/native-navigation");
  const { hidden, tabbarHidden, active, labels } = state;
  await NativeNavigation.setTabbar({
    hidden: hidden || tabbarHidden,
    // Limite du plugin (Android) : il ne sait pas « désélectionner ». Hors onglets (profil,
    // notifications, amis…), on n'envoie pas d'id et le dernier onglet visité reste surligné.
    ...(active ? { selectedId: active } : {}),
    labels: true,
    icons: true,
    tabs: [
      { id: "home", title: labels.home, icon: { svg: ICONS.home } },
      { id: "search", title: labels.search, icon: { svg: ICONS.search } },
      { id: "discover", title: labels.discover, icon: { svg: ICONS.discover } },
      {
        id: "messages",
        title: labels.messages,
        icon: { svg: ICONS.messages },
        ...(state.unreadMessages > 0 ? { badge: state.unreadMessages } : {}),
      },
      { id: "groups", title: labels.groups, icon: { svg: ICONS.groups } },
    ],
  });
  await NativeNavigation.setNavbar({
    hidden,
    title: "Friendszy",
    backButton: { visible: false },
    rightItems: [
      {
        id: "notifications",
        title: labels.notifications,
        icon: { svg: state.unreadNotifications > 0 ? ICONS.bellDot : ICONS.bell },
      },
      { id: "profile", title: labels.profile, icon: { svg: ICONS.user } },
    ],
  });
}

// Boucle « dernier état gagne » : tant qu'un nouvel état a été posé pendant
// l'application du précédent, on le ré-applique.
async function flushBars(
  stateRef: { current: BarsState | null },
  flushingRef: { current: boolean }
) {
  if (flushingRef.current) return;
  flushingRef.current = true;
  try {
    while (stateRef.current) {
      const next = stateRef.current;
      stateRef.current = null;
      try {
        await applyBars(next);
      } catch {
        // plugin indisponible : le prochain changement d'état réessaiera
      }
    }
  } finally {
    flushingRef.current = false;
  }
}

export function NativeChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Nav");
  const unreadNotifications = useUnreadNotificationsCount();
  const unreadMessages = useUnreadConversationsCount();
  const activeConversationId = useActiveConversationId();
  // Vues de chat plein écran (conversation 1:1 ouverte, chat de groupe) : elles ont leur
  // propre en-tête (retour, signaler, bloquer) et leur zone de saisie en bas, que les
  // barres natives recouvriraient. On les masque le temps du chat.
  const chatMode = activeConversationId !== null || GROUP_CHAT_RE.test(pathname);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    if (!isNativeApp()) return;
    const editable = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.isContentEditable ||
        (el instanceof HTMLTextAreaElement && !el.readOnly) ||
        (el instanceof HTMLInputElement &&
          !el.readOnly &&
          !["checkbox", "radio", "button", "submit", "file", "range", "color", "image", "reset"].includes(el.type)));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onIn = (e: FocusEvent) => {
      if (!editable(e.target)) return;
      clearTimeout(timer);
      setKeyboardOpen(true);
    };
    const onOut = () => {
      clearTimeout(timer);
      // délai : passer d'un champ à l'autre ne doit pas faire clignoter la barre
      timer = setTimeout(() => setKeyboardOpen(editable(document.activeElement)), 150);
    };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Écouteurs : tap sur onglet / bouton du haut, bouton retour Android.
  useEffect(() => {
    if (!isNativeApp()) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    (async () => {
      const [{ NativeNavigation }, { App }] = await Promise.all([
        import("@capgo/native-navigation"),
        import("@capacitor/app"),
      ]);
      if (cancelled) return;
      const initial = await NativeNavigation.configure({ contentInsetMode: "css" });
      applyInsets(initial.insets);
      const onInsets = (e: Event) =>
        applyInsets((e as CustomEvent<{ insets: Insets }>).detail?.insets);
      window.addEventListener("capNativeNavigation:safeAreaChanged", onInsets);
      cleanups.push(() => window.removeEventListener("capNativeNavigation:safeAreaChanged", onInsets));
      const tab = await NativeNavigation.addListener("tabSelect", ({ id }) => {
        router.push(TAB_ROUTES[id as TabId] ?? "/");
      });
      const item = await NativeNavigation.addListener("navbarItemTap", ({ id }) => {
        router.push(id === "profile" ? "/profile" : "/notifications");
      });
      // Retour : on remonte l'historique ; à la racine d'un onglet, on quitte l'app.
      const back = await App.addListener("backButton", () => {
        if (ROOT_PATHS.has(pathnameRef.current) || window.history.length <= 1) {
          void App.exitApp();
        } else {
          window.history.back();
        }
      });
      cleanups.push(
        () => void tab.remove(),
        () => void item.remove(),
        () => void back.remove(),
      );
    })();
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
    };
  }, [router]);

  // Liens externes (hors friendszy.ca) et liens target="_blank" : navigateur
  // intégré (@capacitor/browser), jamais dans la WebView. mailto:/tel: restent
  // gérés par le système.
  useEffect(() => {
    if (!isNativeApp()) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      let url: URL;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      const internal =
        url.hostname === window.location.hostname || /(^|\.)friendszy\.ca$/.test(url.hostname);
      if (internal && a.target !== "_blank") return;
      e.preventDefault();
      void import("@capacitor/browser").then(({ Browser }) => Browser.open({ url: url.href }));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // État des barres : onglet actif, libellés (langue courante), badges.
  // Les appels au plugin sont asynchrones et peuvent se terminer dans le
  // désordre : un ancien état (sans badge) écrasait alors le nouveau. On
  // sérialise donc tout : un seul appel à la fois, et seul le DERNIER état
  // demandé est appliqué (les intermédiaires sont ignorés).
  const barsStateRef = useRef<BarsState | null>(null);
  const barsFlushingRef = useRef(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    // Les barres sont des vues Android indépendantes de la page : elles survivent à un
    // rechargement complet (ex. déconnexion → /login). On ne les montre donc que sur les
    // pages avec la sidebar web (AppShell, repérée par data-app-shell) ; partout ailleurs
    // (connexion, accueil public, CGU, confidentialité…) elles sont masquées.
    barsStateRef.current = {
      hidden: chatMode || !document.querySelector("[data-app-shell]"),
      tabbarHidden: keyboardOpen,
      active: activeTab(pathname),
      unreadMessages,
      unreadNotifications,
      labels: {
        home: t("home"),
        search: t("search"),
        discover: t("discover"),
        messages: t("messages"),
        groups: t("groups"),
        notifications: t("notifications"),
        profile: t("profile"),
      },
    };
    void flushBars(barsStateRef, barsFlushingRef);
  }, [pathname, t, unreadMessages, unreadNotifications, chatMode, keyboardOpen]);

  return null;
}
