// Thin promise wrapper around navigator.geolocation — used only for a
// manual, user-triggered snapshot (a "Me localiser" click), never
// watchPosition/continuous tracking. See set_map_location() in
// supabase/migrations/20260922110000_profiles_map_location.sql for why the
// resulting coordinates are only ever used raw on the client (self-only
// mode) or sent once to be fuzzed server-side (visible-to-others mode).
export function getBrowserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("geolocation-unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000,
    });
  });
}
