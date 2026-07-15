"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";

const LOCALES = ["fr", "en"] as const;

export function LocaleToggle() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex rounded-full bg-bg p-1 text-xs font-bold">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => router.replace(pathname, { locale: l })}
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
