"use client";

// Deep links (Phase 6). Android App Links : un lien https://friendszy.ca/...
// ouvre l'app (voir l'intent-filter autoVerify de AndroidManifest.xml et
// public/.well-known/assetlinks.json). La WebView charge toujours server.url
// (la racine) ; ici on la renvoie vers le chemin demandé par le lien.
// Monté dans le layout racine : doit marcher aussi pour un visiteur non
// connecté (lien de confirmation / de réinitialisation du mot de passe).

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native/is-native-app";

const HANDLED_KEY = "friendszy:deep-link-handled";

function go(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return;
  }
  const internal =
    url.hostname === window.location.hostname || /(^|\.)friendszy\.ca$/.test(url.hostname);
  if (!internal || (url.protocol !== "https:" && url.protocol !== "http:")) return;
  // Chemin relatif : on garde l'origine courante (prod, ou 10.0.2.2 en dev).
  const target = url.pathname + url.search + url.hash;
  if (target === window.location.pathname + window.location.search + window.location.hash) return;
  window.location.assign(target);
}

export function NativeDeepLinks() {
  useEffect(() => {
    if (!isNativeApp()) return;
    let remove: (() => void) | undefined;
    let cancelled = false;
    void import("@capacitor/app").then(async ({ App }) => {
      if (cancelled) return;
      // App déjà ouverte (ou en arrière-plan) : un nouveau lien arrive.
      const handle = await App.addListener("appUrlOpen", ({ url }) => go(url));
      remove = () => void handle.remove();
      // Lancement à froid par un lien : une seule fois, sinon chaque rechargement
      // de la page (go() recharge) rejouerait le même lien.
      const launch = await App.getLaunchUrl();
      if (launch?.url) {
        try {
          if (sessionStorage.getItem(HANDLED_KEY) === launch.url) return;
          sessionStorage.setItem(HANDLED_KEY, launch.url);
        } catch {
          // sessionStorage indisponible : on traite quand même le lien
        }
        go(launch.url);
      }
    });
    return () => {
      cancelled = true;
      remove?.();
    };
  }, []);
  return null;
}
