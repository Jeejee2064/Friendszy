"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SettingsSections } from "@/components/settings/settings-sections";

// Style pilule d'origine (avant le découpage en onglets) : ces boutons
// vivaient en haut de toute la page, désormais dans l'onglet Paramètres.
const chipButtonClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-teal2 hover:text-teal2";
const signOutChipClass =
  "inline-flex items-center gap-1.5 rounded-full border border-[#a8543a]/30 px-3.5 py-1.5 text-xs font-semibold transition-colors hover:border-[#a8543a] disabled:opacity-60";

/**
 * "Settings" tab : tout ce qui vivait avant sur /settings (PWA, notifications
 * push, export de données, lien vers la politique de confidentialité, reset
 * du consentement cookies, suppression de compte — voir SettingsSections)
 * est repris ici directement, pour qu'il n'y ait plus besoin de naviguer
 * vers une autre page. /settings reste accessible en direct (même contenu,
 * via SettingsPageClient) mais n'est plus le seul chemin pour y accéder.
 * La ville temporaire vit dans l'onglet Infos (voir profile-form.tsx).
 */
export function ProfileSettingsSection() {
  const t = useTranslations("Profile");
  const locale = useLocale();

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Link href="/friends?tab=blocked" className={chipButtonClass}>
          🚫 {t("blockedUsersLink")}
        </Link>
        <SignOutButton iconOnly={false} className={signOutChipClass} />
      </div>

      <SettingsSections locale={locale} />
    </div>
  );
}
