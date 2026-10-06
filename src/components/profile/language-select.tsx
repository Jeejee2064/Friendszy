"use client";

import { useLocale, useTranslations } from "next-intl";
import { CustomMultiSelect } from "@/components/ui/custom-multi-select";
import { LANGUAGE_CODES, MAX_LANGUAGES, languageLabel } from "@/lib/profile/types";

export function LanguageSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (languages: string[]) => void;
}) {
  const locale = useLocale();
  const tFields = useTranslations("ProfileFields");

  return (
    <CustomMultiSelect
      value={value}
      onChange={onChange}
      max={MAX_LANGUAGES}
      placeholder={tFields("languagesPlaceholder")}
      options={LANGUAGE_CODES.map((code) => ({ value: code, label: languageLabel(code, locale) }))}
    />
  );
}
