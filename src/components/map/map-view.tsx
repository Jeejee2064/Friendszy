"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Map, { Marker, NavigationControl, Popup, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTranslations } from "next-intl";
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
  subtitle?: string | null;
  imageUrl?: string | null;
  /** Route to the detail view this point's popup should link to. */
  href: string;
};

// Visual language for each point type — extend this map (not the component)
// when a new kind of pin is needed. borderColor is a solid color (not the
// gradient) since it's also used as a CSS border-color for photo pins,
// which can't render a gradient border on a circle cleanly.
const MARKER_STYLE: Record<
  MapPointKind,
  { emoji: string; style: CSSProperties; borderColor: string }
> = {
  event: { emoji: "📅", style: { backgroundImage: "var(--grad)" }, borderColor: "var(--teal1)" },
  partner: { emoji: "📍", style: { backgroundColor: "var(--blue)" }, borderColor: "var(--blue)" },
};

function MarkerPin({ point, active }: { point: MapPoint; active: boolean }) {
  const style = MARKER_STYLE[point.kind];
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
        style.emoji
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
  onSelectPoint,
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
   * Called when the popup's CTA is clicked, before falling back to
   * navigating to `point.href` as a normal link. Return `true` to say "I
   * handled it myself" (e.g. a point whose "detail page" is really just a
   * spot further down the caller's own current page — switch to it and
   * scroll there instead of a real navigation); return `false`/`undefined`
   * to let the link navigate normally, which is the common case (e.g. a
   * point with a real standalone detail route) and needs no callback at
   * all.
   */
  onSelectPoint?: (point: MapPoint) => boolean;
}) {
  const t = useTranslations("Map");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapRef | null>(null);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [loaded, setLoaded] = useState(false);
  const skippedInitialFitRef = useRef(false);

  // Drop the popup if its point disappears from the list underneath it
  // (e.g. a filter changes what's displayed) — derived at render time
  // rather than synced back into state via an effect.
  const activePopup = selected && points.some((p) => p.id === selected.id) ? selected : null;

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
  }, [points, loaded, initialCenter]);

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
        style={{ width: "100%", height: "100%", borderRadius: "1rem" }}
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
          >
            <Link
              href={activePopup.href}
              className="group block w-full overflow-hidden"
              onClick={(e) => {
                if (onSelectPoint?.(activePopup)) e.preventDefault();
              }}
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
                  <div className="flex h-full w-full items-center justify-center text-4xl">
                    {MARKER_STYLE[activePopup.kind].emoji}
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  {t(activePopup.kind === "event" ? "kindEvent" : "kindPartner")}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 p-3">
                <p className="truncate text-sm font-extrabold text-text group-hover:text-teal2">
                  {activePopup.title}
                </p>
                {activePopup.subtitle && (
                  <p className="truncate text-xs text-muted">{activePopup.subtitle}</p>
                )}
                <span
                  className="mt-1.5 inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {t("viewDetails")}
                  <span aria-hidden>→</span>
                </span>
              </div>
            </Link>
          </Popup>
        )}
      </Map>
    </div>
  );
}
