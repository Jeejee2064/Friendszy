"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import type { Interest } from "@/lib/profile/types";
import { normalizeForSearch } from "@/lib/text";

const CATEGORY_ORDER = [
  "sports",
  "plein_air",
  "arts_creatifs",
  "jeux",
  "lecture",
  "cinema_culture_pop",
  "genres_musicaux",
  "instruments_musique",
  "cuisine",
  "bien_etre",
];

const MAX_FLAT_RESULTS = 8;

export function InterestsGrid({
  interests,
  selectedIds,
  onChange,
  maxSelected,
  flatSearchResults = false,
  autoFocus = false,
}: {
  interests: Interest[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  /** When set, further additions are blocked once selectedIds reaches this count. */
  maxSelected?: number;
  /** When true, a non-empty query renders a single flat list across all
   * categories (capped) instead of the grouped/filtered category view. */
  flatSearchResults?: boolean;
  autoFocus?: boolean;
}) {
  const locale = useLocale();
  const tCategory = useTranslations("InterestCategories");
  const tFields = useTranslations("ProfileFields");
  const [query, setQuery] = useState("");

  const atMax = maxSelected != null && selectedIds.length >= maxSelected;

  function toggle(id: number) {
    const selected = selectedIds.includes(id);
    if (!selected && atMax) return;
    onChange(
      selected
        ? selectedIds.filter((existing) => existing !== id)
        : [...selectedIds, id]
    );
  }

  function labelFor(interest: Interest) {
    return locale === "en" ? interest.label_en : interest.label_fr;
  }

  function renderPill(interest: Interest) {
    const selected = selectedIds.includes(interest.id);
    const disabled = !selected && atMax;
    return (
      <motion.button
        key={interest.id}
        type="button"
        layout
        disabled={disabled}
        onClick={() => toggle(interest.id)}
        whileTap={{ scale: 0.92 }}
        animate={{ scale: selected ? 1.05 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
          selected
            ? "text-white"
            : disabled
              ? "cursor-not-allowed border-border text-muted opacity-50"
              : "border-border text-text"
        }`}
        style={
          selected
            ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
            : undefined
        }
      >
        {interest.emoji ? `${interest.emoji} ` : ""}
        {labelFor(interest)}
      </motion.button>
    );
  }

  const groups = useMemo(() => {
    const map = new Map<string, Interest[]>();
    for (const interest of interests) {
      const category = interest.category ?? "";
      const list = map.get(category) ?? [];
      list.push(interest);
      map.set(category, list);
    }
    return [...map.entries()].sort(([a], [b]) => {
      const aIndex = CATEGORY_ORDER.indexOf(a);
      const bIndex = CATEGORY_ORDER.indexOf(b);
      if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [interests]);

  // Categories that already contain a selected interest start open (useful
  // when editing an existing profile); computed once at mount only.
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    const withSelection = new Set<string>();
    for (const interest of interests) {
      if (interest.category && selectedIds.includes(interest.id)) {
        withSelection.add(interest.category);
      }
    }
    return withSelection;
  });

  function toggleCategory(category: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }

  const normalizedQuery = normalizeForSearch(query);
  const isSearching = normalizedQuery.length > 0;

  const flatMatches = useMemo(() => {
    if (!flatSearchResults || !isSearching) return null;
    return interests
      .filter((interest) => normalizeForSearch(labelFor(interest)).includes(normalizedQuery))
      .slice(0, MAX_FLAT_RESULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flatSearchResults, isSearching, interests, locale, normalizedQuery]);

  const visibleGroups = groups
    .map(([category, items]) => {
      if (!isSearching) return [category, items] as const;
      const filtered = items.filter((interest) =>
        normalizeForSearch(labelFor(interest)).includes(normalizedQuery)
      );
      return [category, filtered] as const;
    })
    .filter(([, items]) => items.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`🔍 ${tFields("interestsSearchPlaceholder")}`}
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-teal2"
      />
      <div className="flex flex-col gap-1">
        {flatMatches ? (
          flatMatches.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">
              {tFields("interestsNoResults")}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 py-2">
              {flatMatches.map(renderPill)}
            </div>
          )
        ) : visibleGroups.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            {tFields("interestsNoResults")}
          </p>
        ) : (
          visibleGroups.map(([category, items]) => {
            const open = isSearching || openCategories.has(category);
            return (
              <div
                key={category || "_"}
                className="border-b border-border py-2 last:border-0"
              >
                {category && (
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="flex w-full items-center justify-between gap-2 text-left text-xs font-bold uppercase tracking-wide text-muted"
                  >
                    <span>
                      {items[0]?.emoji ? `${items[0].emoji} ` : ""}
                      {tCategory.has(category) ? tCategory(category) : category}
                    </span>
                    <span
                      className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    >
                      ⌄
                    </span>
                  </button>
                )}
                {open && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {items.map(renderPill)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
