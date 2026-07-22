"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Modal } from "@/components/ui/modal";

const LOCALES = ["fr", "en"] as const;

function LocalePill({
  locale,
  onSelect,
}: {
  locale: string;
  onSelect: (l: (typeof LOCALES)[number]) => void;
}) {
  return (
    <div className="flex rounded-full bg-bg p-1 text-xs font-bold">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => onSelect(l)}
          className={`flex-1 rounded-full px-3 py-1.5 uppercase transition-colors ${
            locale === l ? "text-white" : "text-muted"
          }`}
          style={locale === l ? { backgroundImage: "var(--grad)" } : undefined}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function LocaleToggle({
  alwaysExpanded = false,
}: {
  // Skips the icon-only mobile collapse — for spots like the login page
  // that have plenty of room and should just always show the FR/EN pill.
  alwaysExpanded?: boolean;
}) {
  const t = useTranslations("Shell");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  function switchTo(l: (typeof LOCALES)[number]) {
    router.replace(pathname, { locale: l });
    setMobileOpen(false);
  }

  if (alwaysExpanded) {
    return <LocalePill locale={locale} onSelect={switchTo} />;
  }

  return (
    <>
      <div className="hidden md:flex">
        <LocalePill locale={locale} onSelect={switchTo} />
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted md:hidden"
      >
        <span className="text-lg">🌐</span>
      </button>

      {/* The FR/EN pill doesn't fit inline in the narrow mobile icon rail
          (it overflows and gets clipped by the sidebar's scroll container)
          — a modal renders centered with real width regardless. */}
      <Modal open={mobileOpen} onClose={() => setMobileOpen(false)} title={t("language")}>
        <LocalePill locale={locale} onSelect={switchTo} />
      </Modal>
    </>
  );
}
