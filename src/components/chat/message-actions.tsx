"use client";

import { useEffect, useRef, useState } from "react";
import { ReactionPicker } from "@/components/chat/reaction-picker";

// Boutons "réagir" / "répondre" à côté d'une bulle de message — partagés
// par les 3 surfaces de chat. Restent visibles en permanence (pas de
// hover-only) : c'est une action du quotidien, pas une action de modération
// rare, et le produit est PWA-first (mobile), où le survol n'existe pas.
export function MessageActions({
  align,
  onReply,
  onReact,
  replyLabel,
  reactLabel,
}: {
  align: "start" | "end";
  onReply: () => void;
  onReact: (emoji: string) => void;
  replyLabel: string;
  reactLabel: string;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  // Englobe le bouton déclencheur ET le popover : un clic sur le bouton
  // compte comme "à l'intérieur", pour laisser son propre onClick gérer le
  // toggle plutôt que de se faire fermer par le listener extérieur puis
  // rouvrir par le toggle (flicker/état incohérent).
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setPickerOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen]);

  return (
    <div ref={containerRef} className="relative flex shrink-0 items-center gap-0.5 pb-1">
      {pickerOpen && (
        <ReactionPicker
          align={align}
          onPick={(emoji) => {
            setPickerOpen(false);
            onReact(emoji);
          }}
        />
      )}
      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label={reactLabel}
        title={reactLabel}
        className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-muted transition-colors hover:bg-bg hover:text-text"
      >
        🙂
      </button>
      <button
        type="button"
        onClick={onReply}
        aria-label={replyLabel}
        title={replyLabel}
        className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-muted transition-colors hover:bg-bg hover:text-text"
      >
        ↩
      </button>
    </div>
  );
}
