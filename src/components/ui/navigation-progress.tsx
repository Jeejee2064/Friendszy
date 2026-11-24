"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

// Fine barre dégradée en haut de l'écran : retour visuel immédiat dès qu'on
// touche un lien interne, avant même que le serveur ait répondu. Elle avance
// par à-coups décroissants (jamais à 100 % tant que la page n'est pas là) et
// se termine quand le chemin change. Sans effet pour les liens externes,
// ancres, nouvel onglet ou clic avec modificateur.
export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const lastPath = useRef(pathname);

  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  // Fin de navigation : le chemin a changé.
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    clear();
    setProgress(1);
    const t = window.setTimeout(() => setProgress(null), 260);
    timers.current.push(t);
  }, [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      clear();
      setProgress(0.12);
      [150, 450, 1100, 2400].forEach((delay, i) => {
        timers.current.push(
          window.setTimeout(() => setProgress([0.35, 0.6, 0.78, 0.9][i]), delay)
        );
      });
      // Garde-fou : ne jamais laisser la barre bloquée si la navigation échoue.
      timers.current.push(window.setTimeout(() => setProgress(null), 10000));
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] pt-[env(safe-area-inset-top)]"
    >
      <AnimatePresence>
        {progress !== null && (
          <motion.div
            key="bar"
            className="h-[3px] origin-left rounded-r-full"
            style={{ backgroundImage: "var(--grad)", boxShadow: "0 0 8px rgba(30,207,176,.6)" }}
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: progress, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
            transition={{ duration: progress === 1 ? 0.15 : 0.6, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
