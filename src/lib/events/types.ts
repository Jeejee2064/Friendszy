import type { Database } from "@/types/supabase";
import type { Interest } from "@/lib/profile/types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type EventPhotoRow = Database["public"]["Tables"]["event_photos"]["Row"];
export type EventRegistrationRow =
  Database["public"]["Tables"]["event_registrations"]["Row"];
export type EventMessageRow = Database["public"]["Tables"]["event_messages"]["Row"];

// Composed client-side — this codebase never does embedded-relationship queries.
export type EventCardData = EventRow & {
  interest: Interest | null;
  coverPhotoUrl: string | null;
  registrationCount: number;
  isRegistered: boolean;
};
