"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { signOutUser } from "@/lib/auth";

export function SignOutButton() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
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
      className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-60 md:justify-start"
      style={{ color: "#a8543a" }}
    >
      <span className="text-lg">🚪</span>
      <span className="hidden md:inline">{t("signOut.submit")}</span>
    </button>
  );
}
