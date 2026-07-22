"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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
  const router = useRouter();
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
      router.push("/login");
      router.refresh();
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
