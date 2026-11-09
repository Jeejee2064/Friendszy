"use client";

// Points d'entrée retirés de la nav en natif (la sidebar web est cachée) :
// Cercle d'amis, Admin (si is_admin), sélecteur de langue, et — exigences
// Apple 1.2/1.5 et Google UGC — contact du soutien, CGU/règles de la
// communauté et politique de confidentialité. Visible uniquement dans l'app
// (classe html.native-app, voir globals.css).

import { useTranslations } from "next-intl";
import { Users, ShieldUser, Mail, FileText, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LocaleToggle } from "@/components/layout/locale-toggle";

const SUPPORT_EMAIL = "securite@friendszy.ca";

export function NativeProfileLinks({ isAdmin }: { isAdmin: boolean }) {
  const t = useTranslations("Nav");
  const tApp = useTranslations("NativeApp");
  const linkClass =
    "flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-text";
  const iconClass = "h-[18px] w-[18px] shrink-0";
  return (
    <div className="native-only mx-auto flex max-w-2xl flex-col gap-2 px-4 pt-4">
      <Link href="/friends" className={linkClass}>
        <Users className={iconClass} aria-hidden /> {t("friends")}
      </Link>
      {isAdmin && (
        <Link href="/admin" className={linkClass}>
          <ShieldUser className={iconClass} aria-hidden /> {t("admin")}
        </Link>
      )}
      <LocaleToggle alwaysExpanded />
      <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">{tApp("helpTitle")}</p>
      <a href={`mailto:${SUPPORT_EMAIL}`} className={linkClass}>
        <Mail className={iconClass} aria-hidden /> {tApp("contactSupport")}
        <span className="ml-auto text-xs font-normal text-muted">{SUPPORT_EMAIL}</span>
      </a>
      <Link href="/terms" className={linkClass}>
        <FileText className={iconClass} aria-hidden /> {tApp("terms")}
      </Link>
      <Link href="/privacy" className={linkClass}>
        <Lock className={iconClass} aria-hidden /> {tApp("privacy")}
      </Link>
    </div>
  );
}
