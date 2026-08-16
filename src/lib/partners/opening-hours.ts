// Shape stored in partner_listings.opening_hours (jsonb) — see the
// migration comment for the exact contract. One range per day is all the
// wizard edits today, but the type stays an array so a future "lunch
// break" split doesn't need a schema change.
export const OPENING_HOURS_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type OpeningHoursDay = (typeof OPENING_HOURS_DAYS)[number];
export type OpeningHoursRange = { open: string; close: string };
export type OpeningHours = Partial<Record<OpeningHoursDay, OpeningHoursRange[]>>;

// Date#getDay() is 0 = Sunday; our keys start at Monday.
const JS_DAY_TO_KEY: OpeningHoursDay[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function dayKeyForDate(date: Date = new Date()): OpeningHoursDay {
  return JS_DAY_TO_KEY[date.getDay()];
}

export function hasAnyHours(hours: OpeningHours | null | undefined): boolean {
  if (!hours) return false;
  return OPENING_HOURS_DAYS.some((day) => (hours[day]?.length ?? 0) > 0);
}

/** null = no hours data at all (don't show an open/closed badge). */
export function isOpenNow(
  hours: OpeningHours | null | undefined,
  now: Date = new Date()
): boolean | null {
  if (!hasAnyHours(hours)) return null;
  const ranges = hours![JS_DAY_TO_KEY[now.getDay()]];
  if (!ranges || ranges.length === 0) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return ranges.some((range) => {
    const [openH, openM] = range.open.split(":").map(Number);
    const [closeH, closeM] = range.close.split(":").map(Number);
    return minutes >= openH * 60 + openM && minutes < closeH * 60 + closeM;
  });
}
