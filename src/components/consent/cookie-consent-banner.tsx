"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getCookieConsent, setCookieConsent, type ConsentChoice } from "@/lib/consent/cookie-consent";

// localStorage isn't available during SSR, and this banner's visibility
// depends on it — useSyncExternalStore is the React-supported way to read
// a client-only store like this without a setState-in-effect anti-pattern
// or a hydration-mismatch warning (it resyncs right after hydration instead
// of comparing server/client output directly).
function subscribe(onChange: () => void) {
  window.addEventListener("cookie-consent-changed", onChange);
  return () => window.removeEventListener("cookie-consent-changed", onChange);
}
function getSnapshot() {
  return getCookieConsent() === null;
}
function getServerSnapshot() {
  // Can't know the stored choice during SSR — default to "not yet decided"
  // so first-time visitors see the banner immediately; a returning visitor
  // with a stored choice resyncs to hidden right after hydration.
  return true;
}

// Bannière en bas de page, pas une modale : pas d'overlay, pas de fermeture
// via Échap ou clic à l'extérieur — seuls les deux boutons ci-dessous la
// ferment, pour un consentement explicite (Loi 25) plutôt qu'un simple
// "dismiss".
export function CookieConsentBanner() {
  const t = useTranslations("CookieConsent");
  const needsChoice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function choose(choice: ConsentChoice) {
    setCookieConsent(choice);
    // useSyncExternalStore has no built-in way to force a resync outside of
    // an actual store change; setCookieConsent above IS that change, but
    // nothing dispatches a "storage" event for same-tab writes, so nudge it.
    window.dispatchEvent(new Event("cookie-consent-changed"));
  }

  if (!needsChoice) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-4 shadow-lg">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 sm:flex-row sm:justify-between">
        <p className="text-sm text-text">
          {t("body")}{" "}
          <Link href="/privacy" className="font-semibold text-teal2 underline">
            {t("privacyLink")}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("declined")}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted hover:border-teal2 hover:text-teal2"
          >
            {t("decline")}
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="rounded-full px-4 py-2 text-sm font-bold text-white"
            style={{ backgroundImage: "var(--grad)" }}
          >
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
