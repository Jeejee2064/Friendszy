"use client";

import { useLocale } from "next-intl";
import type { Interest } from "@/lib/profile/types";

export function InterestsGrid({
  interests,
  selectedIds,
  onChange,
}: {
  interests: Interest[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}) {
  const locale = useLocale();

  function toggle(id: number) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((existing) => existing !== id)
        : [...selectedIds, id]
    );
  }

  const groups = new Map<string, Interest[]>();
  for (const interest of interests) {
    const category = interest.category ?? "";
    const list = groups.get(category) ?? [];
    list.push(interest);
    groups.set(category, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([category, items]) => (
        <div key={category || "_"}>
          {category && (
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
              {category}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {items.map((interest) => {
              const selected = selectedIds.includes(interest.id);
              const label = locale === "en" ? interest.label_en : interest.label_fr;
              return (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggle(interest.id)}
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
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
