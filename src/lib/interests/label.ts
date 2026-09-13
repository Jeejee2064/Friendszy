// Shared by every place that displays an interest's name in the viewer's
// locale (discover, search, friends, groups, events, partners, admin...).
// `label_es` is nullable — the interests catalogue predates Spanish (see
// CLAUDE.md) and existing rows aren't backfilled — so `es` falls back to
// French, same as any locale next-intl doesn't otherwise recognize.
export type LocalizedInterestLabel = {
  label_fr: string;
  label_en: string;
  label_es?: string | null;
};

// Named distinctly from the many local `interestLabel`/`labelFor` helpers
// across the app (search-page-client, friends-page-client, GroupCard...) so
// importing this doesn't collide with them.
export function localizedInterestLabel(interest: LocalizedInterestLabel, locale: string): string {
  if (locale === "en") return interest.label_en;
  if (locale === "es") return interest.label_es || interest.label_fr;
  return interest.label_fr;
}
