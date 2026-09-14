// Construit le libellé "X écrit..." à partir des noms des personnes
// actuellement en train d'écrire — partagé par les 3 surfaces de chat.
// Chaque appelant fournit ses propres traductions (namespace Messages /
// Groups / Events) via ces 3 callbacks plutôt que des clés figées, pour ne
// rien présupposer sur le système d'i18n utilisé.
export function typingLabel(
  names: string[],
  t: {
    one: (name: string) => string;
    two: (a: string, b: string) => string;
    many: (count: number) => string;
  }
): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return t.one(names[0]);
  if (names.length === 2) return t.two(names[0], names[1]);
  return t.many(names.length);
}
