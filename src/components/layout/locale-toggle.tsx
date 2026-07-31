"use client";

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

export function LocaleToggle({
  alwaysExpanded = false,
}: {
  // Skips the icon-only mobile collapse — for spots like the login page
  // that have plenty of room and should just always show the FR/EN pill.
  alwaysExpanded?: boolean;
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(l: (typeof LOCALES)[number]) {
    router.replace(pathname, { locale: l });
  }

  if (alwaysExpanded) {
    return <LocalePill locale={locale} onSelect={switchTo} />;
  }

  return (
    <>
      <div className="hidden md:flex">
        <LocalePill locale={locale} onSelect={switchTo} />
      </div>

      {/* The FR/EN pill doesn't fit inline in the narrow mobile icon rail
          (~48px of usable width), so this stacks FR above EN in a compact
          column instead of hiding the selector behind a tap-to-open modal. */}
      <div className="flex flex-col gap-1 md:hidden">
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => switchTo(l)}
            className={`rounded-lg py-1 text-center text-[10px] font-bold uppercase transition-colors ${
              locale === l ? "text-white" : "text-muted"
            }`}
            style={locale === l ? { backgroundImage: "var(--grad)" } : undefined}
          >
            {l}
          </button>
        ))}
      </div>
    </>
  );
}
