"use client";

import { OPENING_HOURS_DAYS, type OpeningHours, type OpeningHoursDay } from "@/lib/partners/opening-hours";

const DEFAULT_RANGE = { open: "09:00", close: "17:00" };

export function OpeningHoursEditor({
  value,
  onChange,
  dayLabels,
  closedLabel,
  copyToAllLabel,
}: {
  value: OpeningHours;
  onChange: (hours: OpeningHours) => void;
  dayLabels: Record<OpeningHoursDay, string>;
  closedLabel: string;
  copyToAllLabel: string;
}) {
  function toggleDay(day: OpeningHoursDay, open: boolean) {
    const next = { ...value };
    if (open) {
      next[day] = [{ ...DEFAULT_RANGE }];
    } else {
      delete next[day];
    }
    onChange(next);
  }

  function setRange(day: OpeningHoursDay, field: "open" | "close", time: string) {
    const current = value[day]?.[0] ?? DEFAULT_RANGE;
    onChange({ ...value, [day]: [{ ...current, [field]: time }] });
  }

  function copyMondayToAll() {
    const monday = value.mon?.[0];
    if (!monday) return;
    const next = { ...value };
    for (const day of OPENING_HOURS_DAYS) {
      if (day !== "mon") next[day] = [{ ...monday }];
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-2">
      {OPENING_HOURS_DAYS.map((day) => {
        const range = value[day]?.[0];
        const open = !!range;
        return (
          <div key={day} className="flex items-center gap-2 text-sm">
            <label className="flex w-28 shrink-0 items-center gap-1.5 font-semibold text-text">
              <input
                type="checkbox"
                checked={open}
                onChange={(e) => toggleDay(day, e.target.checked)}
                className="h-4 w-4 accent-[var(--teal2)]"
              />
              {dayLabels[day]}
            </label>
            {open ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={range.open}
                  onChange={(e) => setRange(day, "open", e.target.value)}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                />
                <span className="text-muted">–</span>
                <input
                  type="time"
                  value={range.close}
                  onChange={(e) => setRange(day, "close", e.target.value)}
                  className="rounded-md border border-border px-2 py-1 text-xs"
                />
              </div>
            ) : (
              <span className="text-xs text-muted">{closedLabel}</span>
            )}
          </div>
        );
      })}
      {value.mon?.[0] && (
        <button
          type="button"
          onClick={copyMondayToAll}
          className="mt-1 self-start text-xs font-semibold text-teal2 hover:underline"
        >
          {copyToAllLabel}
        </button>
      )}
    </div>
  );
}
