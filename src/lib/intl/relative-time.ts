import type { useFormatter } from "next-intl";

// For timestamps that are always in the past (message/notification creation
// times): minor client/server clock skew right after an item is created can
// otherwise push `date` a few seconds or more ahead of `now`, flipping the
// tense and showing e.g. "in 1 hour" instead of "1 hour ago". Clamping to
// `now` guarantees we never render a future tense for something that
// already happened.
export function pastRelativeTime(
  format: ReturnType<typeof useFormatter>,
  date: Date,
  now: Date
): string {
  return format.relativeTime(date.getTime() > now.getTime() ? now : date, now);
}
