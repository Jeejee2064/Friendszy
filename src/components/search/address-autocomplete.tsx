"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import type { AddressSuggestion } from "@/lib/geocoding/mapbox";

const DEBOUNCE_MS = 300;

// Same look/behavior as CityAutocomplete, but backed by Mapbox typeahead
// (via /api/geocode/suggest) instead of a local static list — street
// addresses can't be enumerated ahead of time. Only fills the text field on
// selection; LocationPickerMap re-geocodes it into a pin exactly like it
// already does for hand-typed addresses, so no API contract changes there.
export function AddressAutocomplete({
  value,
  onChange,
  city,
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  city?: string;
  placeholder?: string;
  id?: string;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  useEffect(() => {
    const trimmed = value.trim();

    const timeout = setTimeout(async () => {
      if (!trimmed) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch("/api/geocode/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            city: city?.trim() || undefined,
            language: locale === "en" ? "en" : "fr",
          }),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
      } catch {
        // Suggestions are a convenience — a failed fetch just means no
        // dropdown, the user can keep typing the address by hand.
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [value, city, locale]);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(suggestion.label);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg"
            >
              {suggestion.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
