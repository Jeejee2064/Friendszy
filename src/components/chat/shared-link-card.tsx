import { Link } from "@/i18n/navigation";

// Bouton affiché dans une bulle de chat quand le message partage un
// événement ou une activité partenaire (voir extractSharedLink) — évite de
// devoir cliquer sur l'URL brute, qui déclenche le menu contextuel du
// message (répondre/réagir).
export function SharedLinkCard({
  href,
  label,
  isMine,
}: {
  href: string;
  label: string;
  isMine: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
        isMine ? "bg-white/20 text-white" : "text-white"
      }`}
      style={isMine ? undefined : { backgroundImage: "var(--grad)" }}
    >
      🔗 {label}
    </Link>
  );
}
