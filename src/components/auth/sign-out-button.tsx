"use client";

import { useTranslations } from "next-intl";
import { signOutUser } from "@/lib/auth";

export function SignOutButton() {
  const t = useTranslations("Auth");

  return (
    <button
      type="button"
      onClick={() => signOutUser()}
      className="flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold md:justify-start"
      style={{ color: "#a8543a" }}
    >
      <span className="text-lg">🚪</span>
      <span className="hidden md:inline">{t("signOut.submit")}</span>
    </button>
  );
}
