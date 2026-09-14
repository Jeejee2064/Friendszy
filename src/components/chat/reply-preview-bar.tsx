// Bandeau "Réponse à ..." affiché au-dessus du champ de saisie une fois
// qu'on a choisi de répondre à un message — partagé par les 3 surfaces de
// chat. onCancel remet le champ en mode envoi normal.
export function ReplyPreviewBar({
  senderLabel,
  content,
  onCancel,
  cancelLabel,
}: {
  senderLabel: string;
  content: string;
  onCancel: () => void;
  cancelLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 border-t border-border bg-bg px-4 py-2">
      <div className="min-w-0 flex-1 border-l-2 border-teal2 pl-2">
        <p className="truncate text-xs font-bold text-teal2">{senderLabel}</p>
        <p className="truncate text-xs text-muted">{content}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label={cancelLabel}
        title={cancelLabel}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted hover:bg-card hover:text-text"
      >
        ✕
      </button>
    </div>
  );
}
