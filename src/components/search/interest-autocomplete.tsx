"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Interest } from "@/lib/profile/types";
import { normalizeForSearch } from "@/lib/text";

const MAX_INTERESTS = 3;
const MAX_SUGGESTIONS = 8;

export function InterestAutocomplete({
  interests,
  selectedIds,
  onChange,
  myInterestIds,
}: {
  interests: Interest[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  myInterestIds: number[];
}) {
  const locale = useLocale();
  const t = useTranslations("Search");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const byId = useMemo(() => new Map(interests.map((i) => [i.id, i])), [interests]);
  const atMax = selectedIds.length >= MAX_INTERESTS;

  function labelFor(interest: Interest) {
    return locale === "en" ? interest.label_en : interest.label_fr;
  }

  const suggestions = useMemo(() => {
    const normalizedQuery = normalizeForSearch(query);
    if (!normalizedQuery) return [];
    return interests
      .filter((i) => !selectedIds.includes(i.id))
      .filter((i) => normalizeForSearch(labelFor(i)).includes(normalizedQuery))
      .slice(0, MAX_SUGGESTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interests, query, selectedIds, locale]);

  function addInterest(id: number) {
    if (atMax || selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
    setQuery("");
    setOpen(false);
  }

  function removeInterest(id: number) {
    onChange(selectedIds.filter((existing) => existing !== id));
  }

  const quickSuggestions = myInterestIds
    .map((id) => byId.get(id))
    .filter((interest): interest is Interest => !!interest && !selectedIds.includes(interest.id));

  return (
    <div className="flex flex-col gap-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const interest = byId.get(id);
            if (!interest) return null;
            return (
              <span
                key={id}
                className="flex items-center gap-1 rounded-full py-1 pl-3 pr-2 text-xs font-bold text-white"
                style={{ backgroundImage: "var(--grad)" }}
              >
                {interest.emoji ? `${interest.emoji} ` : ""}
                {labelFor(interest)}
                <button
                  type="button"
                  onClick={() => removeInterest(id)}
                  aria-label={t("removeInterest")}
                  className="ml-1 leading-none"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {quickSuggestions.length > 0 && !atMax && (
        <p className="text-xs text-muted">
          {t("yourInterests")}{" "}
          {quickSuggestions.map((interest, i) => (
            <span key={interest.id}>
              <button
                type="button"
                onClick={() => addInterest(interest.id)}
                className="font-semibold text-teal2 hover:underline"
              >
                {labelFor(interest)}
              </button>
              {i < quickSuggestions.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          disabled={atMax}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder={atMax ? t("maxInterestsReached") : t("interestsPlaceholder")}
          className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-teal2 disabled:opacity-60"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            {suggestions.map((interest) => (
              <button
                key={interest.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  addInterest(interest.id);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg"
              >
                {interest.emoji ? `${interest.emoji} ` : ""}
                {labelFor(interest)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
