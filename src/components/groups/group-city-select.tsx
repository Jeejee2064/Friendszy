"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { normalizeForSearch } from "@/lib/text";
import { getCities, type CityOption } from "@/lib/search/cities";

// Multi-select, catalogue-only (no free text — city ids need to be stable
// FK targets for group_cities, unlike the free-text city fields elsewhere,
// see 20260914140000_cities_catalogue.sql). Forked from GroupInterestSelect
// rather than shared with it: this one is inherently multi-select (chips +
// toggle), that one always replaces a single value.
export function GroupCitySelect({
  value,
  onChange,
  collapsible = false,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  // Same collapsible/always-open split as GroupInterestSelect — off by
  // default for the creation wizard/settings form's own dedicated step, on
  // for the discover page's filter panel.
  collapsible?: boolean;
}) {
  const tGroups = useTranslations("Groups");
  const [cities, setCities] = useState<CityOption[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getCities().then((list) => {
      if (!cancelled) setCities(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  function toggle(id: number) {
    onChange(value.includes(id) ? value.filter((existing) => existing !== id) : [...value, id]);
  }

  const byId = useMemo(() => new Map(cities.map((c) => [c.id, c])), [cities]);
  const selectedCities = value
    .map((id) => byId.get(id))
    .filter((c): c is CityOption => !!c);

  const normalizedQuery = normalizeForSearch(query);
  const visibleCities = normalizedQuery
    ? cities.filter((c) => normalizeForSearch(c.name).includes(normalizedQuery))
    : cities;

  function renderPill(city: CityOption) {
    const selected = value.includes(city.id);
    return (
      <motion.button
        key={city.id}
        type="button"
        layout
        onClick={() => toggle(city.id)}
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
        {city.name}
      </motion.button>
    );
  }

  const body = (
    <div className="flex flex-col gap-3">
      {selectedCities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCities.map((city) => (
            <span
              key={city.id}
              className="flex items-center gap-1 rounded-full py-1 pl-3 pr-2 text-xs font-bold text-white"
              style={{ backgroundImage: "var(--grad)" }}
            >
              {city.name}
              <button
                type="button"
                onClick={() => toggle(city.id)}
                aria-label={tGroups("close")}
                className="ml-1 flex h-4 w-4 items-center justify-center leading-none"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tGroups("citiesPlaceholder")}
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-teal2"
      />
      <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
        {visibleCities.length === 0 ? (
          <p className="py-2 text-sm text-muted">{tGroups("inviteNoResults")}</p>
        ) : (
          visibleCities.map(renderPill)
        )}
      </div>
    </div>
  );

  if (!collapsible) return body;

  const closedLabel =
    selectedCities.length > 0
      ? selectedCities.map((c) => c.name).join(", ")
      : tGroups("noCitySelected");

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm outline-none focus:border-teal2 ${
          selectedCities.length > 0 ? "border-teal2 font-semibold text-teal2" : "border-border text-muted"
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
            {body}
          </div>

          {/* Mobile: full-screen panel */}
          <div className="fixed inset-0 z-50 flex flex-col bg-card md:hidden">
            <div className="flex items-center justify-between border-b border-border p-4">
              <span className="font-bold text-text">{tGroups("filterByCityTab")}</span>
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
