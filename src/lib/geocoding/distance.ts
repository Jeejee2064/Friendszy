import type { GeocodedPoint } from "./mapbox";

/**
 * Great-circle distance between two points, in kilometers (haversine
 * formula). Good enough for "which partner listing is nearest the viewer's
 * city" ranking — not turn-by-turn routing, no need for road distance.
 */
export function haversineDistanceKm(a: GeocodedPoint, b: GeocodedPoint): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
