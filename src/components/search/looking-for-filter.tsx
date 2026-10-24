"use client";

import { useLocale, useTranslations } from "next-intl";
import { CustomMultiSelect } from "@/components/ui/custom-multi-select";
import { localizedInterestLabel } from "@/lib/interests/label";
import {
  LOOKING_FOR_OPTIONS,
  MAX_PARTNER_INTERESTS,
  type Interest,
  type LookingFor,
} from "@/lib/profile/types";

// Même menu que « Ce que je recherche » du profil (hors « Autre », qui est du
// texte libre et ne se filtre pas) ; « Partenaire de… » ouvre le choix des
// intérêts, comme sur le profil.
export function LookingForFilter({
  interests,
  lookingFor,
  partnerInterestIds,
  myInterestIds,
  onLookingForChange,
  onPartnerInterestsChange,
}: {
  interests: Interest[];
  lookingFor: LookingFor[];
  partnerInterestIds: number[];
  myInterestIds: number[];
  onLookingForChange: (value: LookingFor[]) => void;
  onPartnerInterestsChange: (ids: number[]) => void;
}) {
  const t = useTranslations("Search");
  const tLookingFor = useTranslations("LookingFor");
  const tFields = useTranslations("ProfileFields");
  const locale = useLocale();

  return (
    <div>
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">
        {t("lookingForLabel")}
      </span>
      <div className="flex flex-col gap-2">
        <CustomMultiSelect
          value={lookingFor}
          onChange={(v) => {
            const next = v as LookingFor[];
            onLookingForChange(next);
            if (!next.includes("activity_partner") && partnerInterestIds.length > 0) {
              onPartnerInterestsChange([]);
            }
          }}
          placeholder={t("lookingForAny")}
          options={LOOKING_FOR_OPTIONS.filter((option) => option !== "other").map((option) => ({
            value: option,
            label: tLookingFor(option),
          }))}
        />
        {lookingFor.includes("activity_partner") && (
          <CustomMultiSelect
            value={partnerInterestIds.map(String)}
            onChange={(v) => onPartnerInterestsChange(v.map(Number))}
            max={MAX_PARTNER_INTERESTS}
            searchPlaceholder={tFields("partnerInterestsSearch")}
            priorityValues={myInterestIds.map(String)}
            placeholder={tFields("partnerInterestsPlaceholder")}
            options={interests.map((interest) => ({
              value: String(interest.id),
              label: localizedInterestLabel(interest, locale),
            }))}
          />
        )}
      </div>
    </div>
  );
}
