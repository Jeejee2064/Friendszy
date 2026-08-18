export type PublicMapPointKind = "event" | "partner";

/**
 * One pin on the public (visiteur non connecté) landing page map — the
 * strictly whitelisted column set returned by the `get_public_map_points`
 * RPC (see supabase/migrations/20260818100000_public_map_points.sql).
 * Deliberately missing: description, registration counts, capacity, and
 * any partner contact info (phone/website/address) or organizer identity.
 */
export type PublicMapPoint = {
  kind: PublicMapPointKind;
  id: string;
  title: string;
  city: string;
  latitude: number;
  longitude: number;
  photoUrl: string | null;
  categoryEmoji: string | null;
  categoryLabelFr: string | null;
  categoryLabelEn: string | null;
};
