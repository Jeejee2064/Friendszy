"use client";

import { useLocale, useTranslations } from "next-intl";
import { CustomMultiSelect } from "@/components/ui/custom-multi-select";
import { localizedInterestLabel } from "@/lib/interests/label";
import {
  LOOKING_FOR_OPTIONS,
  LOOKING_FOR_OTHER_MAX,
  MAX_PARTNER_INTERESTS,
  type Interest,
  type LookingFor,
} from "@/lib/profile/types";

export function LookingForSelect({
  value,
  other,
  interests,
  partnerInterestIds,
  onChange,
  onOtherChange,
  onPartnerInterestsChange,
}: {
  value: LookingFor[];
  other: string;
  interests: Interest[];
  partnerInterestIds: number[];
  onChange: (value: LookingFor[]) => void;
  onOtherChange: (value: string) => void;
  onPartnerInterestsChange: (ids: number[]) => void;
}) {
  const t = useTranslations("LookingFor");
  const tFields = useTranslations("ProfileFields");
  const locale = useLocale();

  return (
    <div className="flex flex-col gap-2">
      <CustomMultiSelect
        value={value}
        onChange={(v) => {
          const next = v as LookingFor[];
          onChange(next);
          // Les intérêts de partenaire n'ont de sens que si « Partenaire de… »
          // est coché : on les vide pour ne pas en garder de cachés.
          if (!next.includes("activity_partner") && partnerInterestIds.length > 0) {
            onPartnerInterestsChange([]);
          }
        }}
        placeholder={tFields("lookingForPlaceholder")}
        options={LOOKING_FOR_OPTIONS.map((option) => ({ value: option, label: t(option) }))}
      />
      {value.includes("activity_partner") && (
        <CustomMultiSelect
          value={partnerInterestIds.map(String)}
          onChange={(v) => onPartnerInterestsChange(v.map(Number))}
          max={MAX_PARTNER_INTERESTS}
          placeholder={tFields("partnerInterestsPlaceholder")}
          options={interests.map((interest) => ({
            value: String(interest.id),
            label: localizedInterestLabel(interest, locale),
          }))}
        />
      )}
      {value.includes("other") && (
        <input
          type="text"
          maxLength={LOOKING_FOR_OTHER_MAX}
          placeholder={tFields("lookingForOtherPlaceholder")}
          value={other}
          onChange={(e) => onOtherChange(e.target.value)}
          className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
        />
      )}
    </div>
  );
}
