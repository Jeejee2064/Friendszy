export type GeocodedPoint = { latitude: number; longitude: number };

/**
 * Wraps the Mapbox geocoding API — shared by the client-facing /api/geocode
 * route (used by LocationPickerMap during creation wizards) and any server
 * component that wants coordinates for a city/address without a client
 * round-trip (e.g. centering the discovery map on the viewer's own city).
 *
 * Never throws — any failure (missing token, network error, timeout, no
 * match) resolves to `null` so callers never need a try/catch.
 */
export async function geocodeAddress(
  city: string,
  address?: string
): Promise<GeocodedPoint | null> {
  const trimmedCity = city.trim();
  if (!trimmedCity) return null;

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  const trimmedAddress = address?.trim() ?? "";
  const query = [trimmedAddress, trimmedCity, "Québec, Canada"].filter(Boolean).join(", ");

  // Without an address, restrict results to actual places/localities (both
  // are used across Quebec's municipalities — e.g. merged cities like
  // Saguenay geocode as "locality", most others as "place") — otherwise
  // Mapbox ranks the query against every feature type (streets, POIs,
  // neighborhoods...) and a well-known city name can lose to an unrelated
  // street with a similar name (e.g. "Laval, Québec, Canada" was matching
  // "Rue Laval" near Quebec City instead of the actual city of Laval near
  // Montréal). With an address present we want that flexibility back, since
  // we're deliberately looking for a precise street-level match.
  const typesParam = trimmedAddress ? "" : "&types=place,locality";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}&country=ca&limit=1${typesParam}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;

    const body = await response.json();
    const coordinates = body?.features?.[0]?.center;
    if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;

    const [longitude, latitude] = coordinates;
    if (typeof latitude !== "number" || typeof longitude !== "number") return null;

    return { latitude, longitude };
  } catch (err) {
    console.error("Mapbox geocoding failed", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
