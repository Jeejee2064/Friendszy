"use client";

import { useEffect, useMemo, useState } from "react";
import { getCityNames, normalizeCityForSearch } from "@/lib/search/cities";

const MAX_SUGGESTIONS = 6;

export function CityAutocomplete({
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cityNames, setCityNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getCityNames().then((names) => {
      if (!cancelled) setCityNames(names);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => {
    const normalizedQuery = normalizeCityForSearch(value);
    if (!normalizedQuery) return [];
    return cityNames
      .filter((city) => normalizeCityForSearch(city).includes(normalizedQuery))
      .slice(0, MAX_SUGGESTIONS);
  }, [value, cityNames]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2 disabled:opacity-60"
      />
      {open && !disabled && suggestions.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
          {suggestions.map((city) => (
            <button
              key={city}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(city);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg"
            >
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
