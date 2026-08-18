"use client";

import { useEffect, useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  listEvents,
  getRegistrationCountsByEvent,
  getMyRegisteredEventIds,
  getCoverPhotosByEvent,
} from "@/lib/events/queries";
import type { EventCardData } from "@/lib/events/types";
import { listPartnerListings, type PartnerListingRow } from "@/lib/partners/queries";
import { isOpenNow, type OpeningHours } from "@/lib/partners/opening-hours";
import type { Interest } from "@/lib/profile/types";
import { haversineDistanceKm } from "@/lib/geocoding/distance";
import { GroupInterestSelect } from "@/components/groups/group-interest-select";
import { CityAutocomplete } from "@/components/search/city-autocomplete";
import { TabButton } from "@/components/ui/tab-button";
import { EventCard } from "@/components/events/event-card";
import { PartnerCard } from "@/components/partners/partner-card";
import { DiscoverFab } from "@/components/discover/discover-fab";
import { MapView, type MapPoint } from "@/components/map/map-view";

type TypeFilter = "both" | "events" | "partners";

export function DiscoverPageClient({
  userId,
  interests,
  initialEvents,
  initialListings,
  initialCenter,
}: {
  userId: string;
  interests: Interest[];
  initialEvents: EventCardData[];
  initialListings: PartnerListingRow[];
  initialCenter: { latitude: number; longitude: number } | null;
}) {
  const t = useTranslations("Discover");
  const tEvents = useTranslations("Events.discovery");
  const locale = useLocale();
  const format = useFormatter();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("both");
  const [interestId, setInterestId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  // Free text (CityAutocomplete, same widget used everywhere else in the
  // app a city is picked) rather than a closed list of only the cities
  // currently in the data — "" means no city filter.
  const [city, setCity] = useState("");
  const [debouncedCity, setDebouncedCity] = useState("");
  // Same idea as the groups discover tab's name search — matched against
  // event titles and partner names.
  const [name, setName] = useState("");
  const [debouncedName, setDebouncedName] = useState("");
  // Découvrir opens straight on the map — that's the point of this page;
  // the list view is still one tap away via the toggle button below.
  const [view, setView] = useState<"map" | "list">("map");

  const [events, setEvents] = useState<EventCardData[]>(initialEvents);
  const [listings, setListings] = useState<PartnerListingRow[]>(initialListings);
  const [loading, setLoading] = useState(false);

  // In map mode the filter bar floats on top of the full-screen map instead
  // of pushing it down — MapView needs to know its real rendered height
  // (it wraps to two lines on narrow screens, so this isn't a fixed
  // number) so it never recenters a clicked pin's popup underneath it.
  const filterBarRef = useRef<HTMLDivElement | null>(null);
  // Starts at a reasonable guess (its actual two-row rendered height),
  // instead of 0, so a pin clicked in the first instant after switching to
  // map mode — before ResizeObserver's first callback has run — still
  // recenters clear of the bar rather than assuming there's no bar at all.
  const [filterBarHeight, setFilterBarHeight] = useState(150);

  useEffect(() => {
    const el = filterBarRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setFilterBarHeight(entry.contentRect.height));
    observer.observe(el);
    return () => observer.disconnect();
  }, [view]);

  // city is free text now (CityAutocomplete) — debounce it before it
  // drives anything network-bound, so typing doesn't fire a query/geocode
  // per keystroke. interestId/date stay undebounced, exactly as before
  // (neither is free text — a select and a native date picker).
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedCity(city.trim()), 400);
    return () => clearTimeout(timeout);
  }, [city]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedName(name.trim()), 400);
    return () => clearTimeout(timeout);
  }, [name]);

  // Where to recenter the map when a city filter is active — geocoded
  // independently of whatever events/listings currently match, so picking
  // a real city always flies there even if nothing's plotted there yet
  // (the whole point of free text over a "only cities with content" list).
  const [focusCenter, setFocusCenter] = useState<{ latitude: number; longitude: number } | null>(
    null
  );
  useEffect(() => {
    if (!debouncedCity) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusCenter(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: debouncedCity }),
      });
      if (!response.ok || cancelled) return;
      const data = await response.json();
      if (!cancelled && typeof data.latitude === "number" && typeof data.longitude === "number") {
        setFocusCenter({ latitude: data.latitude, longitude: data.longitude });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedCity]);

  // Both queries always run together, regardless of typeFilter — switching
  // the type toggle is then instant (a pure render-time filter, no fetch,
  // no loading flicker or race between the two lists), and each query is
  // already cheap on its own.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const interestById = new Map(interests.map((i) => [i.id, i]));

    (async () => {
      setLoading(true);
      const [eventRows, listingRows] = await Promise.all([
        listEvents(supabase, {
          interestId: interestId ?? undefined,
          date: date || undefined,
          city: debouncedCity || undefined,
          name: debouncedName || undefined,
        }),
        listPartnerListings(supabase, {
          interestId: interestId ?? undefined,
          city: debouncedCity || undefined,
          name: debouncedName || undefined,
        }),
      ]);
      const eventIds = eventRows.map((e) => e.id);
      const [counts, myRegistered, coverPhotos] = await Promise.all([
        getRegistrationCountsByEvent(supabase, eventIds),
        getMyRegisteredEventIds(supabase, eventIds, userId),
        getCoverPhotosByEvent(supabase, eventIds),
      ]);
      if (cancelled) return;

      setEvents(
        eventRows.map((event) => ({
          ...event,
          interest: interestById.get(event.interest_id) ?? null,
          coverPhotoUrl: coverPhotos.get(event.id) ?? null,
          registrationCount: counts.get(event.id) ?? 0,
          isRegistered: myRegistered.has(event.id),
        }))
      );
      // Re-apply the same proximity sort used for the initial server-side
      // load, so the Activités order stays consistent across filter
      // changes instead of reverting to "most recently added" after the
      // first refetch.
      setListings(sortByDistance(listingRows, initialCenter));
    })().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestId, date, debouncedCity, debouncedName, userId]);

  function interestFor(id: number) {
    return interests.find((i) => i.id === id);
  }
  function labelFor(interest: Interest) {
    return locale === "en" ? interest.label_en : interest.label_fr;
  }

  const eventPoints: MapPoint[] =
    typeFilter !== "partners"
      ? events
          .filter((event) => event.latitude != null && event.longitude != null)
          .map((event) => {
            const categoryLabel = event.interest
              ? `${event.interest.emoji ? `${event.interest.emoji} ` : ""}${labelFor(event.interest)}`
              : null;
            return {
              id: event.id,
              kind: "event",
              latitude: event.latitude!,
              longitude: event.longitude!,
              title: event.title,
              categoryLabel,
              whenLabel: format.dateTime(new Date(event.starts_at), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
              infoLine:
                event.capacity != null
                  ? tEvents("spotsLimited", { count: event.registrationCount, capacity: event.capacity })
                  : tEvents("spotsUnlimited", { count: event.registrationCount }),
              imageUrl: event.coverPhotoUrl,
              href: `/events/${event.id}`,
            };
          })
      : [];

  const partnerPoints: MapPoint[] =
    typeFilter !== "events"
      ? listings
          .filter((listing) => listing.latitude != null && listing.longitude != null)
          .map((listing) => {
            const interest = interestFor(listing.interest_id);
            const categoryLabel = interest
              ? `${interest.emoji ? `${interest.emoji} ` : ""}${labelFor(interest)}`
              : null;
            return {
              id: listing.id,
              kind: "partner",
              latitude: listing.latitude!,
              longitude: listing.longitude!,
              title: listing.name,
              categoryLabel,
              description: listing.tagline,
              imageUrl: listing.photo_urls[0] ?? null,
              href: `/partners/${listing.id}`,
              isOpenNow: isOpenNow(listing.opening_hours as OpeningHours | null),
            };
          })
      : [];

  const mapPoints: MapPoint[] = [...eventPoints, ...partnerPoints];

  return (
    <div className="p-6 md:p-10">
      {view === "list" && (
        <>
          <h1 className="mb-6 text-2xl font-extrabold text-text">{t("title")}</h1>

          <TypeFilterTabs typeFilter={typeFilter} onChange={setTypeFilter} t={t} />
          <NameSearch name={name} onNameChange={setName} t={t} />
          <CategoryDateFilters
            interests={interests}
            interestId={interestId}
            onInterestChange={setInterestId}
            typeFilter={typeFilter}
            date={date}
            onDateChange={setDate}
            city={city}
            onCityChange={setCity}
            userId={userId}
            t={t}
          />

          <div className="flex flex-col gap-8">
            {(typeFilter === "both" || typeFilter === "events") && (
              <section>
                <h2 className="mb-3 text-lg font-extrabold text-text">{t("sectionEvents")}</h2>
                {loading ? (
                  <p className="text-center text-sm text-muted">{t("loading")}</p>
                ) : events.length === 0 ? (
                  <EmptyState
                    message={t("noResultsEvents")}
                    ctaHref="/events/new"
                    ctaLabel={t("emptyEventsCta")}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {events.map((event) => (
                      <EventCard key={event.id} event={event} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {(typeFilter === "both" || typeFilter === "partners") && (
              <section>
                <h2 className="mb-3 text-lg font-extrabold text-text">{t("sectionPartners")}</h2>
                {loading ? (
                  <p className="text-center text-sm text-muted">{t("loading")}</p>
                ) : listings.length === 0 ? (
                  <EmptyState
                    message={t("noResultsPartners")}
                    ctaHref="/partners/new"
                    ctaLabel={t("emptyPartnersCta")}
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {listings.map((listing) => (
                      <PartnerCard
                        key={listing.id}
                        listing={listing}
                        interests={interests}
                        userId={userId}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </>
      )}

      {/* Stays mounted at all times — even hidden behind display:none in
          list mode — so Mapbox GL never re-initializes when the user
          toggles view. In map mode it's a fixed full-viewport overlay
          (deliberately painting over the sidebar nav rail too — nothing
          in the ancestor chain traps `fixed` positioning, so `inset-0`
          covers the real browser viewport) instead of a small stacked
          card, since the map is meant to be usable on its own, not just
          a decorative thumbnail next to the list. */}
      <MapView
        points={mapPoints}
        initialCenter={initialCenter}
        height="100%"
        className={view === "map" ? "fixed inset-0 z-20 bg-bg" : "hidden"}
        avoidTopPx={view === "map" ? filterBarHeight : 0}
        focusCenter={focusCenter}
      />

      {view === "map" && (
        <div
          ref={filterBarRef}
          className="fixed inset-x-0 top-0 z-30 flex flex-col gap-3 bg-card/95 p-4 shadow-md backdrop-blur-sm"
        >
          <TypeFilterTabs typeFilter={typeFilter} onChange={setTypeFilter} t={t} compact />
          <NameSearch name={name} onNameChange={setName} t={t} compact />
          <CategoryDateFilters
            interests={interests}
            interestId={interestId}
            onInterestChange={setInterestId}
            typeFilter={typeFilter}
            date={date}
            onDateChange={setDate}
            city={city}
            onCityChange={setCity}
            userId={userId}
            t={t}
            compact
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => setView((v) => (v === "map" ? "list" : "map"))}
        className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
        style={{ backgroundImage: "var(--grad)" }}
      >
        {view === "map" ? `📋 ${t("viewList")}` : `🗺️ ${t("viewMap")}`}
      </button>

      <DiscoverFab />
    </div>
  );
}

function TypeFilterTabs({
  typeFilter,
  onChange,
  t,
  compact,
}: {
  typeFilter: TypeFilter;
  onChange: (typeFilter: TypeFilter) => void;
  t: ReturnType<typeof useTranslations<"Discover">>;
  compact?: boolean;
}) {
  return (
    <div className={`flex gap-2 rounded-full p-1 ${compact ? "bg-bg" : "mb-4 bg-card"}`}>
      <TabButton active={typeFilter === "both"} onClick={() => onChange("both")}>
        {t("toggleBoth")}
      </TabButton>
      <TabButton active={typeFilter === "events"} onClick={() => onChange("events")}>
        {t("toggleEvents")}
      </TabButton>
      <TabButton active={typeFilter === "partners"} onClick={() => onChange("partners")}>
        {t("togglePartners")}
      </TabButton>
    </div>
  );
}

// Same search-box treatment as the groups discover tab's "by name" filter —
// matched against event titles and partner names, applied together with
// the category/city/date filters below rather than as a separate mode.
function NameSearch({
  name,
  onNameChange,
  t,
  compact,
}: {
  name: string;
  onNameChange: (name: string) => void;
  t: ReturnType<typeof useTranslations<"Discover">>;
  compact?: boolean;
}) {
  return (
    <div className={`relative ${compact ? "" : "mb-4"}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
        🔍
      </span>
      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("searchPlaceholder")}
        className="w-full rounded-full border border-border bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal2"
      />
    </div>
  );
}

function CategoryDateFilters({
  interests,
  interestId,
  onInterestChange,
  typeFilter,
  date,
  onDateChange,
  city,
  onCityChange,
  userId,
  t,
  compact,
}: {
  interests: Interest[];
  interestId: number | null;
  onInterestChange: (interestId: number | null) => void;
  typeFilter: TypeFilter;
  date: string;
  onDateChange: (date: string) => void;
  city: string;
  onCityChange: (city: string) => void;
  userId: string;
  t: ReturnType<typeof useTranslations<"Discover">>;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap gap-4 ${compact ? "" : "mb-6 rounded-2xl border border-border bg-card p-4"}`}
    >
      <div className="min-w-[220px] flex-1">
        {!compact && (
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            {t("categoryLabel")}
          </p>
        )}
        <GroupInterestSelect
          interests={interests}
          value={interestId}
          onChange={onInterestChange}
          userId={userId}
          allowClear
          collapsible
        />
      </div>
      <div className="min-w-[220px] flex-1">
        {!compact && (
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
            {t("cityLabel")}
          </p>
        )}
        <CityAutocomplete value={city} onChange={onCityChange} placeholder={t("allCities")} />
      </div>
      {typeFilter !== "partners" && (
        <div className="min-w-[220px] flex-1">
          {!compact && (
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
              {t("dateLabel")}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-sm outline-none focus:border-teal2"
            />
            {date && (
              <button
                type="button"
                onClick={() => onDateChange("")}
                className="shrink-0 rounded-lg border border-border px-3 text-sm font-semibold text-muted"
              >
                {t("clearDate")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function sortByDistance(
  listings: PartnerListingRow[],
  center: { latitude: number; longitude: number } | null
): PartnerListingRow[] {
  if (!center) return listings;
  return [...listings].sort((a, b) => {
    const da =
      a.latitude != null && a.longitude != null
        ? haversineDistanceKm(center, { latitude: a.latitude, longitude: a.longitude })
        : Infinity;
    const db =
      b.latitude != null && b.longitude != null
        ? haversineDistanceKm(center, { latitude: b.latitude, longitude: b.longitude })
        : Infinity;
    return da - db;
  });
}

function EmptyState({
  message,
  ctaHref,
  ctaLabel,
}: {
  message: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-sm text-muted">{message}</p>
      <Link
        href={ctaHref}
        className="rounded-full px-4 py-2 text-sm font-bold text-white"
        style={{ backgroundImage: "var(--grad)" }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
