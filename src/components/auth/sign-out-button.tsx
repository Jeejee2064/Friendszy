"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname } from "@/i18n/navigation";
import { signOutUser } from "@/lib/auth";
import { useGoOffline } from "@/lib/presence/presence-context";

export function SignOutButton({
  className,
  iconOnly = true,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const t = useTranslations("Auth");
  const locale = useLocale();
  const goOffline = useGoOffline();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      // Untrack presence while the session is still valid, so other clients
      // see this account go offline live instead of waiting on the socket
      // to drop after the auth token is torn down.
      await goOffline();
      await signOutUser();
      // Hard navigation, not router.push(): the App Router's client-side
      // router cache can otherwise reuse a previous account's cached layout
      // data (e.g. sidebar name/avatar) after a different user signs in on
      // the same browser — a full reload guarantees nothing carries over.
      window.location.href = getPathname({ href: "/login", locale });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={
        className ??
        "flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60 md:justify-start"
      }
      style={{ color: "#a8543a" }}
    >
      <span className="text-lg">🚪</span>
      <span className={iconOnly ? "hidden md:inline" : "inline"}>
        {t("signOut.submit")}
      </span>
    </button>
  );
}
