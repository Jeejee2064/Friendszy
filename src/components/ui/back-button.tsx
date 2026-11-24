import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Bouton retour partagé : 48×48 (≥ cible tactile minimale de 44 px), pastille
// à dégradé teal → bleu, flèche blanche épaisse. Un seul composant pour que
// toutes les pages gardent le même geste de retour, bien visible.
const CLASSES =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow-md shadow-teal2/30 transition-transform active:scale-95 hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal2";

export function BackButton({
  label,
  onClick,
  href,
}: {
  /** Libellé accessible (obligatoire). */
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const icon = <ArrowLeft className="h-6 w-6" strokeWidth={3} aria-hidden />;
  const style = { backgroundImage: "var(--grad)" };
  if (href) {
    return (
      <Link href={href} aria-label={label} className={CLASSES} style={style}>
        {icon}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={CLASSES} style={style}>
      {icon}
    </button>
  );
}
