"use client";

// Points d'entrée retirés de la nav en natif (la sidebar web est cachée) :
// Cercle d'amis, Admin (si is_admin) et sélecteur de langue. Visible
// uniquement dans l'app (classe html.native-app, voir globals.css).

import { useTranslations } from "next-intl";
import { Users, ShieldUser } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LocaleToggle } from "@/components/layout/locale-toggle";

export function NativeProfileLinks({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("Nav");
  const linkClass =
    "flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text";
  return (
    <div className="native-only mx-auto flex max-w-2xl flex-col gap-2 px-4 pt-4">
      <Link href="/friends" className={linkClass}>
        <Users className="h-[18px] w-[18px]" aria-hidden /> {t("friends")}
      </Link>
      {isAdmin && (
        <Link href="/admin" className={linkClass}>
          <ShieldUser className="h-[18px] w-[18px]" aria-hidden /> {t("admin")}
        </Link>
      )}
      <LocaleToggle alwaysExpanded />
    </div>
  );
}
