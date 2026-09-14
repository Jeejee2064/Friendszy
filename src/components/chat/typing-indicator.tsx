// "X écrit..." sous la liste de messages — partagé par les 3 surfaces de
// chat. `label` est déjà résolu (voir typingLabel) ; null = personne
// n'écrit, ne rend rien (plutôt que de réserver un espace vide en
// permanence, pour ne pas faire sauter le scroll de la liste à chaque
// apparition/disparition).
export function TypingIndicator({ label }: { label: string | null }) {
  if (!label) return null;

  return (
    <div className="flex items-center gap-1.5 px-4 pb-1 text-xs text-muted">
      <span className="flex items-end gap-0.5">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
      </span>
      <span>{label}</span>
    </div>
  );
}
