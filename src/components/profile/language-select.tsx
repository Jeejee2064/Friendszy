"use client";

import { useLocale } from "next-intl";
import { LANGUAGE_CODES, MAX_LANGUAGES, languageLabel } from "@/lib/profile/types";

export function LanguageSelect({
  value,
  onChange,
}: {
  value: string[];
  onChange: (languages: string[]) => void;
}) {
  const locale = useLocale();

  function toggle(code: string) {
    if (value.includes(code)) {
      onChange(value.filter((c) => c !== code));
    } else if (value.length < MAX_LANGUAGES) {
      onChange([...value, code]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {LANGUAGE_CODES.map((code) => {
        const selected = value.includes(code);
        return (
          <button
            key={code}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(code)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
              selected ? "text-white" : "border-border text-text"
            }`}
            style={
              selected ? { backgroundImage: "var(--grad)", borderColor: "transparent" } : undefined
            }
          >
            {languageLabel(code, locale)}
          </button>
        );
      })}
    </div>
  );
}
