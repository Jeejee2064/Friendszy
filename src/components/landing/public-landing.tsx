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
// start depending on a field the public RPC doesn't actually return. The
// pin styling itself (photo when there's one, colored icon otherwise) is
// deliberately the same visual language as MapView's MarkerPin though —
// borderColor is a solid color rather than the gradient for the same
// reason as there: a photo pin's border can't render a CSS gradient
// cleanly on a circle.
const MARKER_STYLE: Record<
  PublicMapPoint["kind"],
  { icon: LucideIcon; style: CSSProperties; borderColor: string }
> = {
  event: { icon: Calendar, style: { backgroundImage: "var(--grad)" }, borderColor: "var(--teal1)" },
  partner: { icon: MapPin, style: { backgroundColor: "var(--blue)" }, borderColor: "var(--blue)" },
};

function MarkerPin({ point }: { point: PublicMapPoint }) {
  const style = MARKER_STYLE[point.kind];
  const Icon = style.icon;
  const [imageFailed, setImageFailed] = useState(false);
  const showPhoto = point.photoUrl && !imageFailed;

  return (
    <button
      type="button"
      aria-label={point.title}
      className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-base shadow-md transition-transform hover:scale-110"
      style={
        showPhoto
          ? { border: `3px solid ${style.borderColor}` }
          : { ...style.style, border: "3px solid white" }
      }
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={point.photoUrl!}
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
  // Set when "En savoir plus" is clicked — a second, explicit confirmation
  // step explaining *why* before handing off to /i/[kind]/[id] (which sets
  // the intent cookie and redirects to /login), rather than sending an
  // anonymous visitor straight there with no warning.
  const [detailGate, setDetailGate] = useState<PublicMapPoint | null>(null);

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

          {points.map((point) => (
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
              <MarkerPin point={point} />
            </Marker>
          ))}

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
                {/* No city line: the pin's own position on the map already
                    says where it is — redundant text here just repeats
                    what's obvious from context (and every point is in the
                    Montréal area for now anyway). */}
              </div>
              <div className="flex items-center justify-between gap-2 px-3 pb-3">
                {/* Doesn't navigate straight to /i/[kind]/[id] itself — that
                    hands off to sign-up with no warning. Opens the
                    detailGate explanation modal below instead. */}
                <button
                  type="button"
                  onClick={() => setDetailGate(selected)}
                  className="inline-flex w-fit items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {t("viewMore")}
                </button>
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

      {/* Persistent conversion CTA once the visitor is actually exploring
          the map — the initial gate popup's own "S'inscrire" only exists
          before "Découvrir" is clicked, and the empty-state banner below
          already carries its own CTA, so this one only shows for the
          "free-roaming a populated map" case that otherwise has none. */}
      {discovered && points.length > 0 && (
        <Link
          href="/login?mode=signUp"
          className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {t("signUp")}
        </Link>
      )}

      {/* Explains *why* before handing off to /i/[kind]/[id] (sets the
          intent cookie, redirects to /login) — see the button above. */}
      {detailGate && (
        <div role="dialog" aria-modal="true" aria-label={t("detailGateTitle")}>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setDetailGate(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-lg">
              <p className="text-3xl">🔒</p>
              <h2 className="mt-2 text-lg font-extrabold text-text">{t("detailGateTitle")}</h2>
              <p className="mt-2 text-sm text-muted">
                {t("detailGateBody", { title: detailGate.title })}
              </p>
              <div className="mt-6 flex flex-col items-stretch gap-3">
                {/* Plain <a>, not the i18n Link: this has to be a real GET
                    navigation to the route handler (it sets the intent
                    cookie then redirects), not a soft client-side
                    transition. */}
                <a
                  href={getPathname({ href: `/i/${detailGate.kind}/${detailGate.id}`, locale })}
                  className="rounded-full px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {t("signUp")}
                </a>
                <button
                  type="button"
                  onClick={() => setDetailGate(null)}
                  className="text-sm font-semibold text-muted hover:underline"
                >
                  {tMap("close")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
