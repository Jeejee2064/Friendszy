"use client";

import { useState, type CSSProperties } from "react";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useLocale, useTranslations } from "next-intl";
import { Calendar, MapPin, X, type LucideIcon } from "lucide-react";
import { Link, getPathname } from "@/i18n/navigation";
import { MAP_STYLE } from "@/components/map/map-view";
import type { PublicMapPoint } from "@/lib/publicMap/types";

// Montréal — "le plus de contenu s'y trouvera au départ" (spec). Unlike the
// authenticated /discover map, this one is never centered on a viewer's own
// city: there's no profile to read one from yet.
const MONTREAL_CENTER: [number, number] = [-73.6, 45.5];
const DEFAULT_ZOOM = 10.3;

// Deliberately not MapView (src/components/map/map-view.tsx) — that one's
// popups/cards assume the full authenticated data shape (description,
// spots left, open/closed, ...). This is its own small, dedicated
// component so the public (anon) rendering path can never accidentally
// start depending on a field the public RPC doesn't actually return.
const MARKER_STYLE: Record<PublicMapPoint["kind"], { icon: LucideIcon; style: CSSProperties }> = {
  event: { icon: Calendar, style: { backgroundImage: "var(--grad)" } },
  partner: { icon: MapPin, style: { backgroundColor: "var(--blue)" } },
};

export function PublicLanding({
  points,
  hasChosenDiscover,
}: {
  points: PublicMapPoint[];
  hasChosenDiscover: boolean;
}) {
  const t = useTranslations("PublicLanding");
  const tMap = useTranslations("Map");
  const locale = useLocale();

  const [discovered, setDiscovered] = useState(hasChosenDiscover);
  const [discovering, setDiscovering] = useState(false);
  const [selected, setSelected] = useState<PublicMapPoint | null>(null);

  async function handleDiscover() {
    setDiscovering(true);
    try {
      // Best-effort: even if this fails, `discovered` still flips below so
      // the visitor isn't stuck behind the popup for the rest of this
      // visit — they'll just see it again next time (has_chosen_discover
      // cookie in src/lib/intent/cookie.ts).
      await fetch("/api/discover-cookie", { method: "POST" });
    } finally {
      setDiscovering(false);
      setDiscovered(true);
    }
  }

  function categoryLabel(point: PublicMapPoint) {
    const label = locale === "en" ? point.categoryLabelEn : point.categoryLabelFr;
    if (!label) return null;
    return point.categoryEmoji ? `${point.categoryEmoji} ${label}` : label;
  }

  return (
    <div className="fixed inset-0 bg-bg">
      {/* The map itself always renders — gating is purely visual (blur +
          scrim) plus disabling pointer events, never a second copy of the
          data withheld behind JS state; the RPC already only ever returns
          the public column set regardless of `discovered`. */}
      <div
        className={`h-full w-full transition-[filter] duration-300 ${
          discovered ? "" : "pointer-events-none blur-sm brightness-90"
        }`}
      >
        <Map
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
          initialViewState={{
            longitude: MONTREAL_CENTER[0],
            latitude: MONTREAL_CENTER[1],
            zoom: DEFAULT_ZOOM,
          }}
          mapStyle={MAP_STYLE}
          style={{ width: "100%", height: "100%" }}
        >
          <NavigationControl position="bottom-left" />

          {points.map((point) => {
            const Icon = MARKER_STYLE[point.kind].icon;
            return (
              <Marker
                key={`${point.kind}-${point.id}`}
                longitude={point.longitude}
                latitude={point.latitude}
                anchor="bottom"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelected(point);
                }}
              >
                <button
                  type="button"
                  aria-label={point.title}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-base shadow-md transition-transform hover:scale-110"
                  style={MARKER_STYLE[point.kind].style}
                >
                  <Icon className="h-4 w-4 text-white" strokeWidth={2} aria-hidden />
                </button>
              </Marker>
            );
          })}

          {selected && (
            <Popup
              longitude={selected.longitude}
              latitude={selected.latitude}
              anchor="bottom"
              offset={24}
              maxWidth="260px"
              onClose={() => setSelected(null)}
              closeOnClick={false}
              closeButton={false}
            >
              <div
                className="relative h-24 w-full overflow-hidden"
                style={!selected.photoUrl ? MARKER_STYLE[selected.kind].style : undefined}
              >
                {selected.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <PopupIcon kind={selected.kind} />
                )}
                <span className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  {tMap(selected.kind === "event" ? "kindEvent" : "kindPartner")}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 p-3">
                <p className="truncate text-sm font-extrabold text-text">{selected.title}</p>
                {categoryLabel(selected) && (
                  <span className="w-fit rounded-full border border-teal2 px-2 py-0.5 text-[11px] font-semibold text-teal2">
                    {categoryLabel(selected)}
                  </span>
                )}
                <p className="text-xs text-muted">📍 {selected.city}</p>
              </div>
              <div className="flex items-center justify-between gap-2 px-3 pb-3">
                {/* Plain <a>, not the i18n Link: this has to be a real GET
                    navigation to the route handler below (it sets the
                    intent cookie then redirects), not a soft client-side
                    transition. */}
                <a
                  href={getPathname({ href: `/i/${selected.kind}/${selected.id}`, locale })}
                  className="inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {t("viewMore")}
                </a>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label={tMap("close")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-text"
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </div>
            </Popup>
          )}
        </Map>
      </div>

      {/* Global empty state only (no per-viewport detection) — see the
          plan: engaging enough for launch, when the whole map has nothing
          yet, without the complexity of tracking the visible viewport. */}
      {discovered && points.length === 0 && (
        <div className="fixed bottom-6 left-1/2 z-30 w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 rounded-2xl border border-border bg-card p-4 text-center shadow-lg">
          <p className="text-sm text-text">{t("emptyState")}</p>
          <Link
            href="/login?mode=signUp"
            className="mt-3 inline-block rounded-full px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {t("emptyStateCta")}
          </Link>
        </div>
      )}

      {!discovered && (
        <div role="dialog" aria-modal="true" aria-label={t("tagline")}>
          <div className="fixed inset-0 z-40 bg-black/30" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-lg">
              <p className="text-3xl">👋</p>
              <h1 className="mt-2 text-lg font-extrabold text-text">{t("tagline")}</h1>
              <div className="mt-6 flex flex-col items-stretch gap-3">
                <Link
                  href="/login?mode=signUp"
                  className="rounded-full px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {t("signUp")}
                </Link>
                <button
                  type="button"
                  onClick={handleDiscover}
                  disabled={discovering}
                  className="rounded-full border border-border px-5 py-2.5 text-sm font-bold text-text transition-colors hover:border-teal2 disabled:opacity-60"
                >
                  {t("discover")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PopupIcon({ kind }: { kind: PublicMapPoint["kind"] }) {
  const Icon = MARKER_STYLE[kind].icon;
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Icon className="h-8 w-8 text-white" strokeWidth={1.75} aria-hidden />
    </div>
  );
}
