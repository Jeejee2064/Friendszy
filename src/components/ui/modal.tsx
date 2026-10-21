"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";

export function Modal({
  open,
  onClose,
  title,
  children,
  // "top" is for content the user needs to keep reading while acting
  // outside the page (e.g. the OS share sheet covering the bottom of the
  // screen) — centering it would put it right where that sheet slides in.
  align = "center",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  align?: "center" | "top";
}) {
  const t = useTranslations("Common");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain bg-black/40 p-4 ${
        align === "top" ? "items-start pt-3 sm:pt-6" : "items-start"
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-lg sm:p-6 ${
          align === "top" ? "" : "my-auto"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-lg text-muted transition-colors hover:bg-bg hover:text-text"
        >
          ✕
        </button>
        {title && <h2 className="mb-4 pr-8 text-lg font-extrabold text-text">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
