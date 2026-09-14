// Citation compacte du message d'origine, affichée à l'intérieur d'une
// bulle qui répond à un autre message — partagée par les 3 surfaces de
// chat. `tone` ajuste le contraste selon que la bulle porteuse est en
// dégradé (message envoyé) ou sur fond clair (message reçu).
export function QuotedMessage({
  senderLabel,
  content,
  tone,
  onClick,
}: {
  senderLabel: string;
  content: string;
  tone: "mine" | "theirs";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-1.5 block w-full truncate rounded-lg border-l-2 px-2 py-1 text-left text-xs ${
        tone === "mine"
          ? "border-white/60 bg-white/15 text-white/90"
          : "border-teal2 bg-white/60 text-text"
      }`}
    >
      <span className="block truncate font-bold">{senderLabel}</span>
      <span className="block truncate opacity-90">{content}</span>
    </button>
  );
}
