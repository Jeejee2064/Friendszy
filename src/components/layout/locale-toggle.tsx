"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

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

export function LocaleToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  function switchTo(l: (typeof LOCALES)[number]) {
    router.replace(pathname, { locale: l });
    setMobileOpen(false);
  }

  return (
    <>
      <div className="hidden md:flex">
        <LocalePill locale={locale} onSelect={switchTo} />
      </div>

      <div className="md:hidden">
        {mobileOpen ? (
          <LocalePill locale={locale} onSelect={switchTo} />
        ) : (
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-muted"
          >
            <span className="text-lg">🌐</span>
          </button>
        )}
      </div>
    </>
  );
}
