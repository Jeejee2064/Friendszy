export type GeocodedPoint = { latitude: number; longitude: number };

export type AddressSuggestion = { label: string; latitude: number; longitude: number };

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

/**
 * Typeahead suggestions for a street address, backing AddressAutocomplete.
 * Same Mapbox endpoint as geocodeAddress() (autocomplete=true is its
 * default), restricted to `types=address` so we don't surface POIs/cities
 * while someone is typing a civic number + street. Never throws — any
 * failure (missing token, network error, timeout, no match) resolves to
 * `[]` so callers never need a try/catch.
 */
export async function suggestAddresses(
  query: string,
  { city, language }: { city?: string; language?: "fr" | "en" } = {}
): Promise<AddressSuggestion[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return [];

  const trimmedCity = city?.trim() ?? "";
  const searchText = trimmedCity ? `${trimmedQuery}, ${trimmedCity}` : trimmedQuery;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const params = new URLSearchParams({
      access_token: token,
      country: "ca",
      types: "address",
      autocomplete: "true",
      limit: "5",
    });
    if (language) params.set("language", language);

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchText)}.json?${params}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return [];

    const body = await response.json();
    const features = Array.isArray(body?.features) ? body.features : [];

    return features
      .map((feature: { address?: string; text?: string; center?: unknown }) => {
        const coordinates = feature.center;
        if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
        const [longitude, latitude] = coordinates;
        if (typeof latitude !== "number" || typeof longitude !== "number") return null;
        // Civic number + street only (e.g. "123 rue Principale") — the
        // `address` field already holds just the street elsewhere in the
        // app, city is a separate field, so we don't want the full
        // "123 rue Principale, Laval, Québec, Canada" place_name here.
        const label = feature.address ? `${feature.address} ${feature.text}` : feature.text;
        if (!label) return null;
        return { label, latitude, longitude };
      })
      .filter((s: AddressSuggestion | null): s is AddressSuggestion => s !== null);
  } catch (err) {
    console.error("Mapbox address suggestions failed", err);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
