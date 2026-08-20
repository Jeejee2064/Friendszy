"use client";

import { useTranslations } from "next-intl";

// Shared step list for the two places that explain the iOS "Add to Home
// Screen" flow: the auto-shown install banner and the manual instructions
// in Settings. Keep both in sync by editing here, not in each caller.
export function IosInstallSteps({ className = "" }: { className?: string }) {
  const t = useTranslations("Pwa");
  const steps = [t("iosStep1"), t("iosStep2"), t("iosStep3")];

  return (
    <ol className={`space-y-2 text-left text-sm text-muted ${className}`}>
      {steps.map((step, i) => (
        <li key={i} className="flex items-start gap-2">
          <span
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
