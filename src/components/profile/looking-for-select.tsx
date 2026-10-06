"use client";

import { useTranslations } from "next-intl";
import { CustomMultiSelect } from "@/components/ui/custom-multi-select";
import { LOOKING_FOR_OPTIONS, LOOKING_FOR_OTHER_MAX, type LookingFor } from "@/lib/profile/types";

export function LookingForSelect({
  value,
  other,
  onChange,
  onOtherChange,
}: {
  value: LookingFor[];
  other: string;
  onChange: (value: LookingFor[]) => void;
  onOtherChange: (value: string) => void;
}) {
  const t = useTranslations("LookingFor");
  const tFields = useTranslations("ProfileFields");

  return (
    <div className="flex flex-col gap-2">
      <CustomMultiSelect
        value={value}
        onChange={(v) => onChange(v as LookingFor[])}
        placeholder={tFields("lookingForPlaceholder")}
        options={LOOKING_FOR_OPTIONS.map((option) => ({ value: option, label: t(option) }))}
      />
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
