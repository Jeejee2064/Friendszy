"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Map, { Marker, NavigationControl, Popup, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTranslations } from "next-intl";
import { ArrowRight, Calendar, MapPin, X, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Swap this one constant to change the map's visual style later (e.g. a
// custom Mapbox Studio style) — nothing else in this component depends on
// which style is loaded.
export const MAP_STYLE = "mapbox://styles/mapbox/streets-v12";

// Same default center/zoom used by the partner listing pin picker — keeps
// every map in the app opening on the same view when it has no points yet
// and no initialCenter (geocoded viewer city) is available.
const DEFAULT_CENTER: [number, number] = [-71.5, 52]; // Québec
const DEFAULT_ZOOM = 4.5;
const SINGLE_POINT_ZOOM = 12;
const CITY_ZOOM = 11;

// How far (in screen pixels) a clicked pin is nudged, on top of clearing
// `avoidTopPx`, toward the top of the map's unobstructed area rather than
// its vertical middle — leaves nearly all of that area's height free below
// the pin for its popup, which always opens downward.
const RECENTER_TOP_BIAS = 60;

export type MapPointKind = "event" | "partner";

export type MapPoint = {
  id: string;
  kind: MapPointKind;
  latitude: number;
  longitude: number;
  title: string;
  imageUrl?: string | null;
  /** Route to the detail view this point's popup should link to. */
  href: string;
  /**
   * Open/closed right now, for a partner listing with opening hours set —
   * same tri-state as `isOpenNow()` in @/lib/partners/opening-hours:
   * null/undefined means "no hours data, don't show a badge" (also the
   * only state events ever pass, since they have no opening hours).
   */
  isOpenNow?: boolean | null;
  /** Interest/category pill, e.g. "🎲 Board games" — same badge shown on the cards. */
  categoryLabel?: string | null;
  /** Short blurb: a partner's tagline, or omitted for events (their card has no equivalent). */
  description?: string | null;
  /** Formatted date + time, events only — e.g. "Dec 3, 2:00 PM". */
  whenLabel?: string | null;
  /** One extra bold line of card-equivalent info — event spots left, mainly. */
  infoLine?: string | null;
};

// Visual language for each point type — extend this map (not the component)
// when a new kind of pin is needed. borderColor is a solid color (not the
// gradient) since it's also used as a CSS border-color for photo pins,
// which can't render a gradient border on a circle cleanly.
const MARKER_STYLE: Record<
  MapPointKind,
  { icon: LucideIcon; style: CSSProperties; borderColor: string }
> = {
  event: { icon: Calendar, style: { backgroundImage: "var(--grad)" }, borderColor: "var(--teal1)" },
  partner: { icon: MapPin, style: { backgroundColor: "var(--blue)" }, borderColor: "var(--blue)" },
};

function MarkerPin({ point, active }: { point: MapPoint; active: boolean }) {
  const style = MARKER_STYLE[point.kind];
  const Icon = style.icon;
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = point.imageUrl && !imageFailed;

  return (
    <button
      type="button"
      aria-label={point.title}
      className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-base shadow-md transition-transform duration-150 hover:scale-110 hover:shadow-lg active:scale-95 ${
        active ? "scale-110 ring-2 ring-offset-2" : ""
      }`}
      style={{
        ...(showPhoto
          ? { border: `3px solid ${style.borderColor}` }
          : { ...style.style, border: "3px solid white" }),
        ...(active
          ? ({ "--tw-ring-color": style.borderColor, "--tw-ring-offset-color": "var(--bg)" } as CSSProperties)
          : {}),
      }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={point.imageUrl!}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Icon className="h-4 w-4 text-white" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}

export function MapView({
  points,
  initialCenter = null,
  height = "24rem",
  className,
  avoidTopPx = 0,
  focusCenter = null,
}: {
  points: MapPoint[];
  /**
   * Where to open the map before considering `points` at all — typically
   * the viewer's own geocoded city on a discovery page. When set, the very
   * first render centers here (at a city-level zoom) instead of auto-fitting
   * to `points`' extent; every later change to `points` (e.g. a filter)
   * still auto-fits normally. When null/unavailable, falls back to the
   * original always-auto-fit behavior.
   */
  initialCenter?: { latitude: number; longitude: number } | null;
  /** Any valid CSS height (e.g. "24rem", "100%"). */
  height?: string;
  className?: string;
  /**
   * Height, in screen pixels, of anything rendered by the *caller* on top
   * of this map's own top edge — e.g. a floating filter bar in a
   * full-screen map layout. MapView has no way to see that overlay itself
   * (it's outside this component), so without this hint a clicked pin near
   * the top can get recentered right underneath it, and its popup — which
   * opens upward when there's "enough" room above the pin — ends up
   * rendered behind the caller's opaque overlay instead of visible. Pass
   * the overlay's real rendered height (e.g. measured via ResizeObserver)
   * so the pin is always recentered clear of it. Defaults to 0 (no
   * obstruction) for the common case of a map with nothing overlaid on it.
   */
  avoidTopPx?: number;
  /**
   * When set, overrides the usual "auto-fit to `points`' extent" behavior
   * (see `initialCenter` above) — the map flies here instead, regardless of
   * how many points are currently showing (including zero). Meant for an
   * explicit "show me this place" pick the caller controls (e.g. a city
   * filter), not for panning driven by `points` itself. Cleared back to
   * `null` to go back to the normal fit-to-points behavior.
   */
  focusCenter?: { latitude: number; longitude: number } | null;
}) {
  const t = useTranslations("Map");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [loaded, setLoaded] = useState(false);
  const skippedInitialFitRef = useRef(false);

  // mapbox-gl's own `trackResize` option (on by default) only listens for
  // the browser *window*'s resize event — it has no idea when this
  // component's own container changes size independently of the window
  // (exactly our case: MapView stays permanently mounted and just toggles
  // its wrapper between `hidden` and a full-viewport `fixed inset-0`, see
  // the caller). Without this, the canvas stays stuck at whatever size it
  // had the moment it was first mounted — collapsed, since it mounts while
  // still hidden — and never grows to fill the container once it becomes
  // visible. Watch the container ourselves and force a resize on any
  // change; harmless to also have `trackResize`'s own window listener
  // running alongside this, an extra resize() call is a cheap no-op.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Drop the popup if its point disappears from the list underneath it
  // (e.g. a filter changes what's displayed) — derived at render time
  // rather than synced back into state via an effect.
  const activePopup = selected && points.some((p) => p.id === selected.id) ? selected : null;
  const PopupIcon = activePopup ? MARKER_STYLE[activePopup.kind].icon : null;

  // Re-fit the view to the current point set's extent every time it
  // changes — except the very first time, when an initialCenter was
  // supplied: initialViewState already opened the map there, so leave it
  // alone instead of immediately jumping to fit every point in view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    if (initialCenter && !skippedInitialFitRef.current) {
      skippedInitialFitRef.current = true;
      return;
    }
    skippedInitialFitRef.current = true;

    // An explicit pick (e.g. a city filter) always wins over fitting to
    // whatever points happen to be showing — including flying there even
    // when that leaves zero points on screen, since the point is to show
    // the place the caller asked for, not what's incidentally plotted.
    if (focusCenter) {
      map.flyTo({
        center: [focusCenter.longitude, focusCenter.latitude],
        zoom: CITY_ZOOM,
        duration: 700,
      });
      return;
    }

    if (points.length === 0) {
      const fallback = initialCenter
        ? { center: [initialCenter.longitude, initialCenter.latitude] as [number, number], zoom: CITY_ZOOM }
        : { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM };
      map.flyTo({ ...fallback, duration: 0 });
      return;
    }
    if (points.length === 1) {
      map.flyTo({
        center: [points[0].longitude, points[0].latitude],
        zoom: SINGLE_POINT_ZOOM,
        duration: 0,
      });
      return;
    }

    const lngs = points.map((p) => p.longitude);
    const lats = points.map((p) => p.latitude);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 48, maxZoom: 14, duration: 0 }
    );
  }, [points, loaded, initialCenter, focusCenter]);

  const initialLongitude = initialCenter ? initialCenter.longitude : DEFAULT_CENTER[0];
  const initialLatitude = initialCenter ? initialCenter.latitude : DEFAULT_CENTER[1];
  const initialZoom = initialCenter ? CITY_ZOOM : DEFAULT_ZOOM;

  return (
    <div ref={containerRef} className={className} style={{ height }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          longitude: initialLongitude,
          latitude: initialLatitude,
          zoom: initialZoom,
        }}
        mapStyle={MAP_STYLE}
        onLoad={() => setLoaded(true)}
        // No radius here — this canvas is used both edge-to-edge (the
        // full-screen Discover map) and inside a rounded card (event detail
        // page). Whichever rounding is wanted belongs on the *outer*
        // wrapper div (its own `className`, with `overflow-hidden` doing
        // the actual clipping), never hardcoded on the canvas itself —
        // rounding it here regardless of context used to show as small
        // triangular gaps at each corner of the full-screen map, since that
        // wrapper has no radius/clipping of its own to match it.
        style={{ width: "100%", height: "100%" }}
      >
        <NavigationControl position="bottom-left" />

        {points.map((point) => (
          <Marker
            key={point.id}
            longitude={point.longitude}
            latitude={point.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelected(point);
              // The map itself might be scrolled only partially into the
              // browser's viewport (e.g. on mobile, below a sticky filter
              // bar) — bring the whole container into view first so the
              // recenter below actually lands somewhere visible, instead of
              // just rearranging pixels off-screen.
              containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              // Mapbox's own `padding` option is what recenter/fit
              // operations are meant to use to steer clear of chrome
              // overlaid on the map (it's what `fitBounds`'s own `padding`
              // above is built on) — pushing `avoidTopPx` in here, instead
              // of hand-computing a pixel offset off our own container
              // measurements, means Mapbox itself works out the visible
              // (unobstructed) area from its own live internal size, so
              // there's no risk of it disagreeing with a stale/roundtrip
              // read of our own ref. `offset` then nudges the pin toward
              // the top of that unobstructed area (rather than its
              // vertical middle) so almost all of the remaining height is
              // free for the popup, which always opens downward — see
              // anchor="top" below.
              mapRef.current?.easeTo({
                center: [point.longitude, point.latitude],
                padding: { top: avoidTopPx },
                offset: [0, -RECENTER_TOP_BIAS],
                duration: 300,
              });
            }}
          >
            <MarkerPin point={point} active={activePopup?.id === point.id} />
          </Marker>
        ))}

        {activePopup && (
          <Popup
            longitude={activePopup.longitude}
            latitude={activePopup.latitude}
            anchor="top"
            offset={20}
            maxWidth="260px"
            onClose={() => setSelected(null)}
            closeOnClick={false}
            closeButton={false}
          >
            <Link
              href={activePopup.href}
              className="group block w-full overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-teal2 focus-visible:ring-offset-2"
            >
              <div
                className="relative h-28 w-full overflow-hidden"
                style={
                  !activePopup.imageUrl ? MARKER_STYLE[activePopup.kind].style : undefined
                }
              >
                {activePopup.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={activePopup.imageUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  PopupIcon && (
                    <div className="flex h-full w-full items-center justify-center">
                      <PopupIcon className="h-9 w-9 text-white" strokeWidth={1.75} aria-hidden />
                    </div>
                  )
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  {t(activePopup.kind === "event" ? "kindEvent" : "kindPartner")}
                </span>
                {activePopup.isOpenNow != null && (
                  <span
                    className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm"
                    style={{
                      backgroundColor: activePopup.isOpenNow
                        ? "rgba(30,207,176,0.9)"
                        : "rgba(0,0,0,0.55)",
                    }}
                  >
                    {t(activePopup.isOpenNow ? "openNow" : "closedNow")}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 p-3 pb-1.5">
                <p className="truncate text-sm font-extrabold text-text group-hover:text-teal2">
                  {activePopup.title}
                </p>
                {activePopup.whenLabel && (
                  <p className="flex items-center gap-1 text-xs font-bold text-teal2">
                    <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                    {activePopup.whenLabel}
                  </p>
                )}
                {activePopup.categoryLabel && (
                  <span className="w-fit rounded-full border border-teal2 px-2 py-0.5 text-[11px] font-semibold text-teal2">
                    {activePopup.categoryLabel}
                  </span>
                )}
                {activePopup.description && (
                  <p className="line-clamp-2 text-xs text-muted">{activePopup.description}</p>
                )}
                {activePopup.infoLine && (
                  <p className="text-xs font-semibold text-muted">{activePopup.infoLine}</p>
                )}
              </div>
            </Link>

            {/* Deliberately outside the Link above (nesting an <a> inside
                another <a> is invalid HTML) — and, per feedback, no longer
                Mapbox's own top-right close "×" sharing the same corner as
                the open/closed badge on the photo. One clear choice at the
                bottom instead: view details, or close. */}
            <div className="flex items-center justify-between gap-2 px-3 pb-3">
              <Link
                href={activePopup.href}
                className="inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ backgroundImage: "var(--grad)" }}
              >
                {t("viewDetails")}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={t("close")}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-text"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
