"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LocateFixed } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { createClient } from "@/lib/supabase/client";
import { getBrowserPosition } from "@/lib/map/geolocation";
import { clearMapLocation, setMapLocation } from "@/lib/map/queries";
import { LocationPickerMap } from "@/components/map/location-picker-map";

/**
 * Floating "locate me" control for the Discover map. Three distinct
 * outcomes, all gated behind an explicit choice made *after* clicking this
 * button (never automatic, never on page load):
 *  - "self only": centers the map on the browser's position, nothing ever
 *    reaches the server.
 *  - "visible to others" (GPS): also persists a fuzzed snapshot via
 *    set_map_location(), which atomically turns sharing on — see
 *    supabase/migrations/20260922110000_profile_locations.sql for why this
 *    is opt-in/off-by-default and never live-tracked.
 *  - "visible to others" (picked by hand): same set_map_location() call,
 *    just fed coordinates from LocationPickerMap's click/drag instead of
 *    navigator.geolocation — the server fuzzes/stores either source
 *    identically. Never touches the GPS, even to pre-center the picker.
 * Once sharing is on, re-opening this control switches to "refresh /
 * choose on map / stop sharing" instead of asking the consent question
 * again — the manual picker stays available afterwards too, to let
 * someone move their point later without going through GPS.
 */
export function MapLocationControl({
  initialSharing,
  initialCenter,
  onLocate,
}: {
  initialSharing: boolean;
  initialCenter: { latitude: number; longitude: number } | null;
  onLocate: (coords: { latitude: number; longitude: number }) => void;
}) {
  const t = useTranslations("MapLocation");
  const [sharing, setSharing] = useState(initialSharing);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [step, setStep] = useState<"choice" | "picker">("choice");
  const [pickedCoords, setPickedCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: initialCenter?.latitude ?? null, longitude: initialCenter?.longitude ?? null });

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

  // Never touches navigator.geolocation — pickedCoords comes entirely from
  // LocationPickerMap's click/drag, pre-seeded from initialCenter just to
  // start the map somewhere reasonable (the viewer's own city).
  async function handlePickedConfirm() {
    if (pickedCoords.latitude == null || pickedCoords.longitude == null) return;
    setLoading(true);
    setError(false);
    try {
      await setMapLocation(createClient(), pickedCoords.latitude, pickedCoords.longitude);
      setSharing(true);
      onLocate({ latitude: pickedCoords.latitude, longitude: pickedCoords.longitude });
      setStep("choice");
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setStep("choice");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t(sharing ? "locateButtonAriaLabelSharing" : "locateButtonAriaLabel")}
        className="fixed bottom-24 right-6 z-30 flex h-11 items-center gap-2 rounded-full bg-card/95 px-4 shadow-md backdrop-blur-sm transition-transform hover:scale-105"
        style={{ color: sharing ? "var(--teal2)" : "var(--text)" }}
      >
        <LocateFixed className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden />
        <span className="text-sm font-semibold">
          {t(sharing ? "locateButtonLabelSharing" : "locateButtonLabel")}
        </span>
      </button>

      <Modal
        open={open}
        onClose={handleClose}
        title={t(step === "picker" ? "pickerTitle" : sharing ? "sharingTitle" : "consentTitle")}
      >
        <div className="flex flex-col gap-4">
          {step === "choice" && (
            <p className="text-sm text-muted">{t(sharing ? "sharingBody" : "consentBody")}</p>
          )}

          {error && <p className="text-sm font-semibold text-[#e55]">{t("error")}</p>}

          {step === "picker" ? (
            <>
              <LocationPickerMap
                city=""
                address=""
                value={pickedCoords}
                onChange={setPickedCoords}
                hintText={t("pickerHint")}
                locatingText={t("pickerHint")}
              />
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  disabled={loading || pickedCoords.latitude == null}
                  onClick={handlePickedConfirm}
                  className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  style={{ backgroundImage: "var(--grad)" }}
                >
                  {t("pickerConfirmButton")}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setStep("choice")}
                  className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
                >
                  {t("backButton")}
                </button>
              </div>
            </>
          ) : (
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
                    onClick={() => setStep("picker")}
                    className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-text disabled:opacity-60"
                  >
                    {t("chooseOnMapButton")}
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
                    onClick={() => setStep("picker")}
                    className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-text disabled:opacity-60"
                  >
                    {t("chooseOnMapButton")}
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
                    onClick={handleClose}
                    className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted disabled:opacity-60"
                  >
                    {t("cancelButton")}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
