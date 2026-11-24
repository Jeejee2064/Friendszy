import { isNativeApp } from "@/lib/native/is-native-app";

// Appelle `callback` chaque fois que l'app redevient utilisable après une
// coupure probable du socket Realtime : onglet/WebView de nouveau visible,
// réseau revenu, app native repassée au premier plan. Dans une WebView
// Android en arrière-plan le socket est coupé sans qu'aucun événement
// d'erreur ne soit levé, donc sans ces déclencheurs les compteurs restent
// figés jusqu'au rechargement. Retourne la fonction de nettoyage.
export function onResync(callback: () => void): () => void {
  const onVisible = () => {
    if (document.visibilityState === "visible") callback();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", callback);
  window.addEventListener("pageshow", callback);

  let removeNative: (() => void) | null = null;
  let disposed = false;
  if (isNativeApp()) {
    void import("@capacitor/app").then(({ App }) =>
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) callback();
      }).then((handle) => {
        if (disposed) void handle.remove();
        else removeNative = () => void handle.remove();
      })
    );
  }

  return () => {
    disposed = true;
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", callback);
    window.removeEventListener("pageshow", callback);
    removeNative?.();
  };
}
