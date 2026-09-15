"use client";

import { useTranslations } from "next-intl";
import { SettingsSections } from "@/components/settings/settings-sections";

export function SettingsPageClient({ locale }: { locale: string }) {
  const t = useTranslations("Settings");

  return (
    <div className="p-6 md:p-10">
      <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>
      <SettingsSections locale={locale} />
    </div>
  );
}
