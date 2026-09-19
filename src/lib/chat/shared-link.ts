// Détecte les messages produits par les boutons "Partager" d'un événement
// ou d'une activité partenaire (event-view-client.tsx, partner-view-client.tsx
// via ShareToFriendModal), qui terminent toujours par l'URL de la fiche sur
// sa propre ligne — quelle que soit la langue du texte qui précède.
const SHARE_URL_RE =
  /(?:^|\s)https?:\/\/\S+\/(events|partners)\/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\s*$/;

export function extractSharedLink(
  content: string | null | undefined
): { kind: "events" | "partners"; id: string; text: string } | null {
  if (!content) return null;
  const match = content.match(SHARE_URL_RE);
  if (!match || match.index === undefined) return null;
  return {
    kind: match[1] as "events" | "partners",
    id: match[2],
    text: content.slice(0, match.index).trim(),
  };
}
