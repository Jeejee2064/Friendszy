import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { EventRow, EventPhotoRow, EventRegistrationRow } from "./types";

type Client = SupabaseClient<Database>;

export async function createEvent(
  supabase: Client,
  fields: {
    id?: string;
    title: string;
    description: string | null;
    city: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    interest_id: number;
    starts_at: string;
    ends_at: string;
    capacity: number | null;
  },
  creatorId: string
): Promise<EventRow> {
  const { data: event, error: eventError } = await supabase
    .from("events")
    .insert({ ...fields, creator_id: creatorId })
    .select("*")
    .single();
  if (eventError) throw eventError;

  // Mirrors createGroup: the creator becomes the event's first participant
  // (counts toward capacity, shows up in the attendee list, and gets chat
  // access via is_event_participant like everyone else).
  const { error: registrationError } = await supabase
    .from("event_registrations")
    .insert({ event_id: event.id, profile_id: creatorId });
  if (registrationError) throw registrationError;

  return event;
}

export async function getEventById(
  supabase: Client,
  eventId: string
): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getEventsByIds(
  supabase: Client,
  ids: string[]
): Promise<EventRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("events").select("*").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

// Archival is just a query-time filter on ends_at (no scheduled job, per
// CLAUDE.md) — includePast opts back into seeing events that already ended.
export async function listEvents(
  supabase: Client,
  filters: {
    interestId?: number;
    date?: string;
    includePast?: boolean;
    city?: string;
    name?: string;
  }
): Promise<EventRow[]> {
  let query = supabase.from("events").select("*").order("starts_at", { ascending: true });

  if (filters.interestId != null) query = query.eq("interest_id", filters.interestId);
  if (filters.name?.trim()) query = query.ilike("title", `%${filters.name.trim()}%`);

  if (filters.city?.trim()) {
    const { data: cityMatches, error: cityError } = await supabase.rpc("match_event_city_ids", {
      p_city: filters.city.trim(),
    });
    if (cityError) throw cityError;
    const ids = (cityMatches ?? []).map((row) => row.id);
    if (ids.length === 0) return [];
    query = query.in("id", ids);
  }

  if (filters.date) {
    // Show events that overlap the picked day at all, not just ones that
    // start on it — a multi-day event starting before should still appear.
    const dayStart = `${filters.date}T00:00:00.000Z`;
    const dayEnd = `${filters.date}T23:59:59.999Z`;
    query = query.lte("starts_at", dayEnd).gte("ends_at", dayStart);
  } else if (!filters.includePast) {
    query = query.gte("ends_at", new Date().toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// events_select RLS is unconditional, but event_registrations RLS restricts
// row visibility to that event's own participants/organizer/admins — a
// stranger querying the table directly gets zero rows back, silently
// under-counting instead of erroring. This RPC is SECURITY DEFINER and
// returns only aggregated counts (never who's registered), same role as
// get_group_member_counts.
export async function getRegistrationCountsByEvent(
  supabase: Client,
  eventIds: string[]
): Promise<Map<string, number>> {
  if (eventIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc("get_event_registration_counts", {
    p_event_ids: eventIds,
  });
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.event_id, Number(row.registration_count));
  }
  return counts;
}

export async function getMyRegisteredEventIds(
  supabase: Client,
  eventIds: string[],
  myId: string
): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("event_registrations")
    .select("event_id")
    .eq("profile_id", myId)
    .in("event_id", eventIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.event_id));
}

export async function getMyRegistration(
  supabase: Client,
  eventId: string,
  myId: string
): Promise<EventRegistrationRow | null> {
  const { data, error } = await supabase
    .from("event_registrations")
    .select("*")
    .eq("event_id", eventId)
    .eq("profile_id", myId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export class EventFullError extends Error {
  constructor() {
    super("This event is full.");
    this.name = "EventFullError";
  }
}

export class EventEndedError extends Error {
  constructor() {
    super("This event has already ended.");
    this.name = "EventEndedError";
  }
}

// Capacity (and "event already ended") are enforced by
// enforce_event_registration_capacity at the DB level — this just turns its
// raised exception into typed errors the UI can show a friendly message for.
export async function registerForEvent(
  supabase: Client,
  eventId: string,
  profileId: string
): Promise<void> {
  const { error } = await supabase
    .from("event_registrations")
    .insert({ event_id: eventId, profile_id: profileId });
  if (error) {
    if (error.message.includes("event is full")) throw new EventFullError();
    if (error.message.includes("already ended")) throw new EventEndedError();
    throw error;
  }
}

export async function unregisterFromEvent(
  supabase: Client,
  eventId: string,
  profileId: string
): Promise<void> {
  const { error } = await supabase
    .from("event_registrations")
    .delete()
    .eq("event_id", eventId)
    .eq("profile_id", profileId);
  if (error) throw error;
}

export async function isEventParticipant(
  supabase: Client,
  eventId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_event_participant", {
    p_event_id: eventId,
  });
  if (error) throw error;
  return !!data;
}

export async function isEventOrganizer(
  supabase: Client,
  eventId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_event_organizer", {
    p_event_id: eventId,
  });
  if (error) throw error;
  return !!data;
}

export async function deleteEvent(supabase: Client, eventId: string) {
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

export async function listEventPhotos(
  supabase: Client,
  eventId: string
): Promise<EventPhotoRow[]> {
  const { data, error } = await supabase
    .from("event_photos")
    .select("*")
    .eq("event_id", eventId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// One cover photo per event (lowest `position`), for cards/map popups —
// events without any photo simply don't appear in the returned map.
export async function getCoverPhotosByEvent(
  supabase: Client,
  eventIds: string[]
): Promise<Map<string, string>> {
  if (eventIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("event_photos")
    .select("event_id, url")
    .in("event_id", eventIds)
    .order("position", { ascending: true });
  if (error) throw error;

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (!map.has(row.event_id)) map.set(row.event_id, row.url);
  }
  return map;
}

// Unlike partner_listings.photo_urls (a plain array column on the listing
// row itself), event_photos is a real table with event_id as a FK — a row
// can't exist before the event does. So the wizard only touches storage
// while collecting photos (bootstrap upload policy allows that against an
// event id that doesn't exist yet), and attachEventPhotos() below writes
// the actual event_photos rows in one batch right after the event is
// created, once a real event_id exists to point them at.
export async function uploadEventPhotoFile(
  supabase: Client,
  eventId: string,
  blob: Blob
): Promise<string> {
  const path = `${eventId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("event-photos")
    .upload(path, blob, { contentType: "image/jpeg" });
  if (error) throw error;

  const { data } = supabase.storage.from("event-photos").getPublicUrl(path);
  return data.publicUrl;
}

export async function removeEventPhotoFile(supabase: Client, url: string) {
  const marker = "/event-photos/";
  const index = url.indexOf(marker);
  if (index === -1) return;
  const path = decodeURIComponent(url.slice(index + marker.length));
  const { error } = await supabase.storage.from("event-photos").remove([path]);
  if (error) throw error;
}

export async function attachEventPhotos(
  supabase: Client,
  eventId: string,
  urls: string[]
): Promise<void> {
  if (urls.length === 0) return;
  const { error } = await supabase
    .from("event_photos")
    .insert(urls.map((url, position) => ({ event_id: eventId, url, position })));
  if (error) throw error;
}

// The event organizer (not just a platform admin) can soft-remove an event
// message — mirrors removeGroupMessage / group_messages_update_admin.
export async function removeEventMessage(
  supabase: Client,
  messageId: string,
  removedById: string
) {
  const { error } = await supabase
    .from("event_messages")
    .update({ removed_at: new Date().toISOString(), removed_by: removedById })
    .eq("id", messageId);
  if (error) throw error;
}
