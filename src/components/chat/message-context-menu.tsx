"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { QUICK_REACTION_EMOJIS } from "@/lib/chat/quick-reactions";

// Menu contextuel d'un message, comme WhatsApp : appui long (tactile) ou
// clic droit / clic (souris) → réagir / répondre / copier / supprimer si on
// en est l'auteur — partagé par les 3 surfaces de chat.
// `children` est la bulle elle-même : c'est le déclencheur. Se ferme au
// clic extérieur, sur Échap, ou après avoir choisi une action.
export function MessageContextMenu({
  align,
  canDelete,
  copyText,
  onReact,
  onReply,
  onDelete,
  replyLabel,
  deleteLabel,
  children,
}: {
  align: "start" | "end";
  canDelete: boolean;
  copyText?: string | null;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onDelete: () => void;
  replyLabel: string;
  deleteLabel: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = useTranslations("MessageMenu");
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerType = useRef("mouse");
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef({ x: 0, y: 0 });

  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }
  useEffect(() => cancelPress, []);

  async function copy() {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = copyText;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 700);
  }

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
        onPointerDown={(e) => {
          pointerType.current = e.pointerType;
          if (e.pointerType === "mouse") return;
          pressOrigin.current = { x: e.clientX, y: e.clientY };
          cancelPress();
          pressTimer.current = setTimeout(() => {
            pressTimer.current = null;
            navigator.vibrate?.(10);
            setOpen(true);
          }, 450);
        }}
        onPointerMove={(e) => {
          if (!pressTimer.current) return;
          if (Math.hypot(e.clientX - pressOrigin.current.x, e.clientY - pressOrigin.current.y) > 10) {
            cancelPress();
          }
        }}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a,button")) return;
          // Au tactile, seul l'appui long ouvre le menu.
          if (pointerType.current !== "mouse") return;
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="cursor-pointer select-none [-webkit-touch-callout:none]"
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg leading-none transition-transform hover:scale-125"
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
          {copyText && (
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-text hover:bg-bg"
            >
              {copied ? `✓ ${t("copied")}` : `📋 ${t("copy")}`}
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex items-center gap-2 whitespace-nowrap rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-[#c42b2b] hover:bg-[#c42b2b]/10"
            >
              🗑️ {deleteLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
