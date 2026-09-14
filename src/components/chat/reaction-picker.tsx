import { QUICK_REACTION_EMOJIS } from "@/lib/chat/quick-reactions";

// Popover des 5 emojis de réaction rapide — partagé par les 3 surfaces de
// chat (messages privés, groupes, événements). La fermeture (clic
// extérieur / Échap) est gérée par l'appelant (voir MessageActions) : ce
// composant ne sait pas si le clic qui l'a ouvert/fermé venait de son
// propre bouton déclencheur.
export function ReactionPicker({
  align,
  onPick,
}: {
  align: "start" | "end";
  onPick: (emoji: string) => void;
}) {
  return (
    <div
      className={`absolute bottom-full z-10 mb-1 flex gap-0.5 rounded-full border border-border bg-card p-1 shadow-lg ${
        align === "end" ? "right-0" : "left-0"
      }`}
    >
      {QUICK_REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onPick(emoji)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
