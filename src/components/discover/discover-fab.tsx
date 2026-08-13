"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Single floating "+" entry point for both creation flows (event, partner
 * listing) — replaces the two separate always-visible header CTAs the old
 * Events/Partners discovery pages each had. No dropdown/popover primitive
 * exists in this codebase (src/components/ui/ only has Modal, Notice,
 * ToastContext), so this is hand-rolled, reusing Modal's dismiss idiom
 * (Escape closes, click-outside closes) rather than a new dependency.
 */
export function DiscoverFab() {
  const t = useTranslations("Discover");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {open && (
          <div
            role="menu"
            className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-lg"
          >
            <Link
              href="/events/new"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-text hover:bg-bg"
            >
              🎉 {t("fab.organizeEvent")}
            </Link>
            <Link
              href="/partners/new"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold text-text hover:bg-bg"
            >
              🏪 {t("fab.addBusiness")}
            </Link>
          </div>
        )}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={t("fab.ariaLabel")}
          onClick={() => setOpen((o) => !o)}
          className="flex h-14 w-14 items-center justify-center rounded-full text-2xl leading-none text-white shadow-lg"
          style={{ backgroundImage: "var(--grad)" }}
        >
          {open ? "×" : "+"}
        </button>
      </div>
    </>
  );
}
