"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { QUICK_REACTION_EMOJIS } from "@/lib/chat/quick-reactions";

// Menu contextuel affiché au clic sur un message (réagir / répondre /
// supprimer si on en est l'auteur) — partagé par les 3 surfaces de chat.
// `children` est la bulle elle-même : c'est le déclencheur. Se ferme au
// clic extérieur, sur Échap, ou après avoir choisi une action.
export function MessageContextMenu({
  align,
  canDelete,
  onReact,
  onReply,
  onDelete,
  replyLabel,
  deleteLabel,
  children,
}: {
  align: "start" | "end";
  canDelete: boolean;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  replyLabel: string;
  deleteLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="cursor-pointer"
      >
        {children}
      </div>
      {open && (
        <div
          className={`absolute bottom-full z-10 mb-1 flex w-max flex-col gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-lg ${
            align === "end" ? "right-0" : "left-0"
          }`}
        >
          <div className="flex gap-0.5 border-b border-border pb-1.5">
            {QUICK_REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReact(emoji);
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onReply();
            }}
            className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-text hover:bg-bg"
          >
            ↩ {replyLabel}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-[#e55] hover:bg-[#e55]/10"
            >
              🗑️ {deleteLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
