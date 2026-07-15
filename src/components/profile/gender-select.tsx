"use client";

import { useTranslations } from "next-intl";
import { GENDERS, type Gender } from "@/lib/profile/types";

export function GenderSelect({
  value,
  onChange,
}: {
  value: Gender | null;
  onChange: (gender: Gender) => void;
}) {
  const t = useTranslations("Gender");

  return (
    <div className="grid grid-cols-2 gap-2">
      {GENDERS.map((gender) => (
        <button
          key={gender}
          type="button"
          onClick={() => onChange(gender)}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
            value === gender ? "text-white" : "border-border text-text"
          }`}
          style={
            value === gender
              ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
              : undefined
          }
        >
          {t(gender)}
        </button>
      ))}
    </div>
  );
}
