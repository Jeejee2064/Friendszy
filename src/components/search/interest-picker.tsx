"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Interest } from "@/lib/profile/types";
import { localizedInterestLabel } from "@/lib/interests/label";
import { InterestsGrid } from "@/components/profile/interests-grid";

export function InterestPicker({
  interests,
  selectedIds,
  onChange,
  myInterestIds,
  userId,
  collapsible = true,
}: {
  interests: Interest[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  myInterestIds: number[];
  userId: string;
  // Closed-by-default, opens into a dropdown (desktop) / full-screen panel
  // (mobile) on click. Off in the discover wizard's own "interests" step,
  // where the picker is the sole content of the step: an always-visible
  // grid (select-all included) avoids hiding the only action behind a
  // click on what reads as a plain search field (same reasoning as
  // GroupInterestSelect's `collapsible`).
  collapsible?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("Search");
  const [open, setOpen] = useState(!collapsible);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(() => new Map(interests.map((i) => [i.id, i])), [interests]);
  const allSelected = interests.length > 0 && selectedIds.length >= interests.length;

  function labelFor(interest: Interest) {
    return localizedInterestLabel(interest, locale);
  }

  function removeInterest(id: number) {
    onChange(selectedIds.filter((existing) => existing !== id));
  }

  function addInterest(id: number) {
    if (selectedIds.includes(id)) return;
    onChange([...selectedIds, id]);
  }

  function toggleSelectAll() {
    onChange(allSelected ? [] : interests.map((i) => i.id));
  }

  const quickSuggestions = myInterestIds
    .map((id) => byId.get(id))
    .filter((interest): interest is Interest => !!interest && !selectedIds.includes(interest.id));

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

  const selectAllButton = (
    <button
      type="button"
      onClick={toggleSelectAll}
      className={
        allSelected
          ? "rounded-full px-3 py-1 text-xs font-bold text-white"
          : "text-xs font-semibold text-teal2 hover:underline"
      }
      style={allSelected ? { backgroundImage: "var(--grad)" } : undefined}
    >
      {allSelected ? t("deselectAllInterests") : t("selectAllInterests")}
    </button>
  );

  const grid = (
    <InterestsGrid
      interests={interests}
      selectedIds={selectedIds}
      onChange={onChange}
      userId={userId}
      flatSearchResults
      autoFocus
    />
  );

  return (
    <div ref={wrapperRef} className="flex flex-col gap-2">
      {selectedIds.length > 0 && !allSelected && (
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
                  className="ml-1 flex h-4 w-4 items-center justify-center leading-none"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}

      {quickSuggestions.length > 0 && !allSelected && (
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

      {!collapsible ? (
        <div className="flex flex-col gap-2">
          <div className="flex justify-end">{selectAllButton}</div>
          {grid}
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-left text-sm text-muted outline-none focus:border-teal2"
          >
            {t("interestsPlaceholder")}
          </button>

          {open && (
            <>
              {/* Desktop: compact dropdown anchored below the field */}
              <div className="absolute z-10 mt-1 hidden w-full rounded-lg border border-border bg-card p-3 shadow-lg md:block">
                <div className="mb-2 flex justify-end">{selectAllButton}</div>
                <div className="max-h-80 overflow-y-auto">{grid}</div>
              </div>

              {/* Mobile: full-screen panel */}
              <div className="fixed inset-0 z-50 flex flex-col bg-card md:hidden">
                <div className="flex items-center justify-between border-b border-border p-4">
                  <span className="font-bold text-text">{t("interestsStepTitle")}</span>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={t("close")}
                    className="text-lg text-muted hover:text-text"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center justify-end border-b border-border px-4 py-2">
                  {selectAllButton}
                </div>
                <div className="flex-1 overflow-y-auto p-4">{grid}</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
