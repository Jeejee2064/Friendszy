export type HighlightSegment = { text: string; match: boolean };

// Découpe `text` en segments autour des occurrences (insensibles à la casse)
// de `query`, pour permettre de surligner un mot-clé recherché dans un message.
export function splitByQuery(text: string, query: string): HighlightSegment[] {
  const trimmed = query.trim();
  if (!trimmed) return [{ text, match: false }];

  const lowerText = text.toLowerCase();
  const lowerQuery = trimmed.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lowerText.indexOf(lowerQuery, cursor);
    if (idx === -1) {
      segments.push({ text: text.slice(cursor), match: false });
      break;
    }
    if (idx > cursor) segments.push({ text: text.slice(cursor, idx), match: false });
    segments.push({ text: text.slice(idx, idx + trimmed.length), match: true });
    cursor = idx + trimmed.length;
  }

  return segments;
}
