"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import type { Interest } from "@/lib/profile/types";
import { normalizeForSearch } from "@/lib/text";
import { SuggestInterestPrompt } from "@/components/interests/suggest-interest-prompt";

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
  "autre",
];

// Forked from InterestsGrid rather than reusing it with maxSelected={1}:
// that component's toggle() is inherently append/remove (multi-select), so
// forcing single-select through it would require deselecting before
// reselecting — a real UX hack. This picker always replaces the value.
export function GroupInterestSelect({
  interests,
  value,
  onChange,
  userId,
  allowClear = false,
  collapsible = false,
}: {
  interests: Interest[];
  value: number | null;
  onChange: (id: number | null) => void;
  /** Who a "suggest this interest" submission (shown when a search yields
   * nothing) is filed under. */
  userId: string;
  allowClear?: boolean;
  // Closed-by-default, opens into a dropdown (desktop) / full-screen panel
  // (mobile) on click — same interaction as InterestPicker on /search.
  // Off by default: the creation wizard/settings form render this as the
  // sole content of their own step, where an always-open grid is fine.
  collapsible?: boolean;
}) {
  const locale = useLocale();
  const tCategory = useTranslations("InterestCategories");
  const tFields = useTranslations("ProfileFields");
  const tGroups = useTranslations("Groups");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  function labelFor(interest: Interest) {
    return locale === "en" ? interest.label_en : interest.label_fr;
  }

  function handleSelect(id: number | null) {
    onChange(id);
    if (collapsible) setOpen(false);
  }

  useEffect(() => {
    if (!collapsible || !open) return;
    function handleOutsideClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [collapsible, open]);

  function renderPill(interest: Interest) {
    const selected = value === interest.id;
    return (
      <motion.button
        key={interest.id}
        type="button"
        layout
        onClick={() => handleSelect(interest.id)}
        whileTap={{ scale: 0.92 }}
        animate={{ scale: selected ? 1.05 : 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
          selected ? "text-white" : "border-border text-text"
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

  const [openCategories, setOpenCategories] = useState<Set<string>>(() => {
    const withSelection = new Set<string>();
    for (const interest of interests) {
      if (interest.category && value === interest.id) {
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

  const visibleGroups = groups
    .map(([category, items]) => {
      if (!isSearching) return [category, items] as const;
      const filtered = items.filter((interest) =>
        normalizeForSearch(labelFor(interest)).includes(normalizedQuery)
      );
      return [category, filtered] as const;
    })
    .filter(([, items]) => items.length > 0);

  const selectedInterest = value != null ? interests.find((i) => i.id === value) : undefined;
  const closedLabel = selectedInterest
    ? `${selectedInterest.emoji ? `${selectedInterest.emoji} ` : ""}${labelFor(selectedInterest)}`
    : tGroups("allInterests");

  const body = (
    <div className="flex flex-col gap-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`🔍 ${tFields("interestsSearchPlaceholder")}`}
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-teal2"
      />
      {allowClear && (
        <div className="flex flex-wrap gap-2">
          <motion.button
            type="button"
            layout
            onClick={() => handleSelect(null)}
            whileTap={{ scale: 0.92 }}
            animate={{ scale: value === null ? 1.05 : 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
              value === null ? "text-white" : "border-border text-text"
            }`}
            style={
              value === null
                ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                : undefined
            }
          >
            {tGroups("allInterests")}
          </motion.button>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {visibleGroups.length === 0 ? (
          isSearching ? (
            <SuggestInterestPrompt query={query} userId={userId} />
          ) : (
            <p className="py-4 text-center text-sm text-muted">
              {tFields("interestsNoResults")}
            </p>
          )
        ) : (
          visibleGroups.map(([category, items]) => {
            const isOpenCategory = isSearching || openCategories.has(category);
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
                      className={`transition-transform duration-200 ${isOpenCategory ? "rotate-180" : ""}`}
                    >
                      ⌄
                    </span>
                  </button>
                )}
                {isOpenCategory && (
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

  if (!collapsible) return body;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none focus:border-teal2 ${
          selectedInterest ? "border-teal2 font-semibold text-teal2" : "border-border text-muted"
        }`}
      >
        <span className="truncate">{closedLabel}</span>
        <span className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          ⌄
        </span>
      </button>

      {open && (
        <>
          {/* Desktop: compact dropdown anchored below the field */}
          <div className="absolute z-10 mt-1 hidden w-full rounded-lg border border-border bg-card p-3 shadow-lg md:block">
            <div className="max-h-80 overflow-y-auto">{body}</div>
          </div>

          {/* Mobile: full-screen panel */}
          <div className="fixed inset-0 z-50 flex flex-col bg-card md:hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="font-bold text-text">{tGroups("filterByInterestTab")}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={tGroups("close")}
                className="text-lg text-muted hover:text-text"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">{body}</div>
          </div>
        </>
      )}
    </div>
  );
}
