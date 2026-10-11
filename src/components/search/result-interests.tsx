"use client";

import { useState } from "react";

export function ResultInterests({
  commonLabels,
  otherLabels,
  commonText,
  title,
  closeLabel,
}: {
  commonLabels: string[];
  otherLabels: string[];
  commonText: string;
  title: string;
  closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  if (commonLabels.length === 0 && otherLabels.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {commonLabels.length > 0 && (
        <p className="text-xs font-semibold text-teal2">{commonText}</p>
      )}
      {otherLabels.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="self-start rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted"
        >
          +{otherLabels.length}
        </button>
      )}
      {open && (
        <div className="rounded-xl border border-border bg-bg p-3">
          <p className="mb-2 text-xs font-bold text-text">{title}</p>
          <div className="flex flex-wrap gap-1.5">
            {[...commonLabels, ...otherLabels].map((label, i) => (
              <span
                key={`${label}-${i}`}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  i < commonLabels.length
                    ? "border border-teal2 text-teal2"
                    : "border border-border text-muted"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 text-xs font-semibold text-teal2"
          >
            {closeLabel}
          </button>
        </div>
      )}
    </div>
  );
}
