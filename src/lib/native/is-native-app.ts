// Vrai uniquement dans le shell Capacitor (Android/iOS). Toujours faux côté
// serveur et dans le navigateur : tout code spécifique à l'app passe par ici.
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
}
