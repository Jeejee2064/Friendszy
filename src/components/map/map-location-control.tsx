"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LocateFixed } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { getBrowserPosition } from "@/lib/map/geolocation";
import { clearMapLocation, setMapLocation } from "@/lib/map/queries";

/**
 * Floating "locate me" control for the Discover map. Two distinct
 * outcomes, both gated behind an explicit choice made *after* clicking this
 * button (never automatic, never on page load):
 *  - "self only": centers the map on the browser's position, nothing ever
 *    reaches the server.
 *  - "visible to others": also persists a fuzzed snapshot via
 *    set_map_location(), which atomically turns sharing on — see
 *    supabase/migrations/20260922110000_profile_locations.sql for why this
 *    is opt-in/off-by-default and never live-tracked.
 * Once sharing is on, re-opening this control switches to "refresh /
 * stop sharing" instead of asking the consent question again.
 */
export function MapLocationControl({
  initialSharing,
  onLocate,
}: {
  initialSharing: boolean;
  onLocate: (coords: { latitude: number; longitude: number }) => void;
}) {
  const t = useTranslations("MapLocation");
  const [sharing, setSharing] = useState(initialSharing);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function withPosition(onSuccess: (coords: GeolocationCoordinates) => Promise<void>) {
    setLoading(true);
    setError(false);
    try {
      const position = await getBrowserPosition();
      await onSuccess(position.coords);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleSelfOnly() {
    return withPosition(async (coords) => {
      onLocate({ latitude: coords.latitude, longitude: coords.longitude });
    });
  }

  function handleVisible() {
    return withPosition(async (coords) => {
      await setMapLocation(createClient(), coords.latitude, coords.longitude);
      setSharing(true);
      onLocate({ latitude: coords.latitude, longitude: coords.longitude });
    });
  }

  async function handleStop() {
    setLoading(true);
    setError(false);
    try {
      await clearMapLocation(createClient());
      setSharing(false);
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t(sharing ? "locateButtonAriaLabelSharing" : "locateButtonAriaLabel")}
        className="fixed bottom-24 right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-card/95 shadow-md backdrop-blur-sm transition-transform hover:scale-105"
        style={{ color: sharing ? "var(--teal2)" : "var(--text)" }}
      >
        <LocateFixed className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={t(sharing ? "sharingTitle" : "consentTitle")}>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t(sharing ? "sharingBody" : "consentBody")}</p>

          {error && <p className="text-sm font-semibold text-[#e55]">{t("error")}</p>}

          <div className="flex flex-col gap-2">
            {sharing ? (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleVisible}
                  className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {t("refreshButton")}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleStop}
                  className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
                >
                  {t("stopButton")}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleVisible}
                  className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {t("visibleButton")}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSelfOnly}
                  className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-text disabled:opacity-60"
                >
                  {t("selfOnlyButton")}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                  className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
                >
                  {t("cancelButton")}
                </button>
              </>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
