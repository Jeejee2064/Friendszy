"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
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
import type { Interest } from "@/lib/profile/types";
import { haversineDistanceKm } from "@/lib/geocoding/distance";
import { GroupInterestSelect } from "@/components/groups/group-interest-select";
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
  const locale = useLocale();

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("both");
  const [interestId, setInterestId] = useState<number | null>(null);
  const [date, setDate] = useState("");
  const [view, setView] = useState<"map" | "list">("list");

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

  // Both queries always run together, regardless of typeFilter — switching
  // the type toggle is then instant (a pure render-time filter, no fetch,
  // no loading flicker or race between the two lists), and each query is
  // already cheap on its own. Neither filter is free text, so no debounce
  // is needed (same reasoning the old Events discovery page used).
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const interestById = new Map(interests.map((i) => [i.id, i]));

    (async () => {
      setLoading(true);
      const [eventRows, listingRows] = await Promise.all([
        listEvents(supabase, { interestId: interestId ?? undefined, date: date || undefined }),
        listPartnerListings(supabase, { interestId: interestId ?? undefined }),
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
  }, [interestId, date, userId]);

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
          .map((event) => ({
            id: event.id,
            kind: "event",
            latitude: event.latitude!,
            longitude: event.longitude!,
            title: event.title,
            subtitle: event.city,
            imageUrl: event.coverPhotoUrl,
            href: `/events/${event.id}`,
          }))
      : [];

  const partnerPoints: MapPoint[] =
    typeFilter !== "events"
      ? listings
          .filter((listing) => listing.latitude != null && listing.longitude != null)
          .map((listing) => {
            const interest = interestFor(listing.interest_id);
            return {
              id: listing.id,
              kind: "partner",
              latitude: listing.latitude!,
              longitude: listing.longitude!,
              title: listing.name,
              subtitle: interest ? labelFor(interest) : listing.city,
              imageUrl: listing.photo_urls[0] ?? null,
              // Activities don't have their own detail route — their
              // "detail page" is really just their own card further down
              // this same page. `/partners` used to be that page and still
              // redirects here for old links/bookmarks, but by then the
              // hash it carried is long gone and there's nothing to scroll
              // to. Point straight at this page's own anchor instead (kept
              // as a real href, not just handled in JS, so opening it in a
              // new tab or reloading it still lands on the right card);
              // `onSelectPoint` below additionally handles the same-page
              // case, where switching to list view has to happen in JS
              // first before that anchor's target even exists to scroll to.
              href: `/discover#partner-${listing.id}`,
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
          <CategoryDateFilters
            interests={interests}
            interestId={interestId}
            onInterestChange={setInterestId}
            typeFilter={typeFilter}
            date={date}
            onDateChange={setDate}
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
        onSelectPoint={(point) => {
          // Events have their own detail route — let the popup's Link
          // navigate there normally. Activities don't: their "detail page"
          // is their own card further down this same page, which only
          // exists in the DOM in list view — switch to it here, then
          // scroll once it's actually rendered.
          if (point.kind !== "partner") return false;
          setView("list");
          requestAnimationFrame(() => {
            document
              .getElementById(`partner-${point.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          });
          return true;
        }}
      />

      {view === "map" && (
        <div
          ref={filterBarRef}
          className="fixed inset-x-0 top-0 z-30 flex flex-col gap-3 bg-card/95 p-4 shadow-md backdrop-blur-sm"
        >
          <TypeFilterTabs typeFilter={typeFilter} onChange={setTypeFilter} t={t} compact />
          <CategoryDateFilters
            interests={interests}
            interestId={interestId}
            onInterestChange={setInterestId}
            typeFilter={typeFilter}
            date={date}
            onDateChange={setDate}
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

function CategoryDateFilters({
  interests,
  interestId,
  onInterestChange,
  typeFilter,
  date,
  onDateChange,
  t,
  compact,
}: {
  interests: Interest[];
  interestId: number | null;
  onInterestChange: (interestId: number | null) => void;
  typeFilter: TypeFilter;
  date: string;
  onDateChange: (date: string) => void;
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
          allowClear
          collapsible
        />
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
