"use client";

export const AGE_MIN = 18;
export const AGE_MAX = 99;

export type AgeBracket = { min: number; max: number; label: string };

export const AGE_BRACKETS: AgeBracket[] = [
  { min: 18, max: 28, label: "18–28" },
  { min: 29, max: 44, label: "29–44" },
  { min: 45, max: 60, label: "45–60" },
  { min: 61, max: AGE_MAX, label: "61+" },
];

export function AgeBracketPicker({
  selected,
  onChange,
}: {
  selected: AgeBracket[];
  onChange: (next: AgeBracket[]) => void;
}) {
  function toggle(bracket: AgeBracket) {
    const isSelected = selected.some((b) => b.min === bracket.min);
    onChange(
      isSelected ? selected.filter((b) => b.min !== bracket.min) : [...selected, bracket]
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {AGE_BRACKETS.map((bracket) => {
        const isSelected = selected.some((b) => b.min === bracket.min);
        return (
          <button
            key={bracket.min}
            type="button"
            onClick={() => toggle(bracket)}
            className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
              isSelected ? "text-white" : "border-border text-text"
            }`}
            style={
              isSelected
                ? { backgroundImage: "var(--grad)", borderColor: "transparent" }
                : undefined
            }
          >
            {bracket.label}
          </button>
        );
      })}
    </div>
  );
}
