"use client";

import { Bell, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useUnreadNotificationsCount } from "@/lib/notifications/notification-center";
import { SignOutButton } from "@/components/auth/sign-out-button";

const ICON_BTN =
  "relative flex h-11 w-11 items-center justify-center rounded-xl text-teal-ink transition-colors hover:bg-bg";

// Profil, Notifications et Déconnexion, regroupés à droite de l'en-tête de l'accueil.
export function HomeHeaderActions() {
  const t = useTranslations("Nav");
  const unread = useUnreadNotificationsCount();

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Link href="/profile" aria-label={t("profile")} title={t("profile")} className={ICON_BTN}>
        <User size={22} strokeWidth={2} aria-hidden="true" />
      </Link>
      <Link
        href="/notifications"
        aria-label={t("notifications")}
        title={t("notifications")}
        className={ICON_BTN}
      >
        <Bell size={22} strokeWidth={2} aria-hidden="true" />
        {unread > 0 && (
          <span
            className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold text-white"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {unread}
          </span>
        )}
      </Link>
      <SignOutButton
        iconOnly
        className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-bg disabled:opacity-60 [&>span]:sr-only"
      />
    </div>
  );
}
