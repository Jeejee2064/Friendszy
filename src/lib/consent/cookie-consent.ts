// Loi 25 (Québec) exige un consentement opt-in avant tout cookie/témoin non
// essentiel (mesure d'audience, publicité...). Rien de tel n'est câblé dans
// l'app aujourd'hui — aucun outil d'analytics n'est installé — mais la
// politique de confidentialité publiée promet déjà que ces témoins "ne sont
// activés qu'avec votre consentement". Ce module est la porte technique
// correspondante, prête à être appelée par la prochaine intégration
// analytics, même si rien ne l'utilise encore.

export type ConsentChoice = "accepted" | "declined";

const STORAGE_KEY = "friendszy:cookie-consent";

function isConsentChoice(value: string | null): value is ConsentChoice {
  return value === "accepted" || value === "declined";
}

/** null = aucun choix fait pour l'instant (première visite). */
export function getCookieConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isConsentChoice(value) ? value : null;
  } catch {
    return null;
  }
}

export function setCookieConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // localStorage indisponible (navigation privée, etc.) — la bannière
    // réapparaîtra à la prochaine visite, ce qui reste correct.
  }
}

/** Efface le choix enregistré — utilisé par le bouton "changer mon choix"
 * des Paramètres pour rouvrir la bannière. */
export function resetCookieConsent() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // rien à faire
  }
}

/** Porte fonctionnelle réelle : toute future intégration analytics doit
 * appeler ceci avant de s'initialiser, et ne rien faire si false. */
export function hasAnalyticsConsent(): boolean {
  return getCookieConsent() === "accepted";
}
