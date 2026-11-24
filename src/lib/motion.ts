// Jetons de mouvement partagés : une seule source pour tout l'app, afin que
// chaque animation ait la même "main". Durée/courbe choisies selon le rôle
// (entrée = décélération, sortie plus courte, éléments d'interface = ressort).

import type { Transition, Variants } from "framer-motion";

export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const DURATION = { fast: 0.15, base: 0.22, slow: 0.32 } as const;

export const SPRING = {
  /** Éléments d'interface (pastille de nav, badges) : vif, sans rebond marqué. */
  ui: { type: "spring", stiffness: 500, damping: 38 } as Transition,
  /** Feuilles, modales, toasts : un léger rebond d'arrivée. */
  overlay: { type: "spring", stiffness: 420, damping: 34 } as Transition,
  /** Apparition d'un compteur / badge. */
  pop: { type: "spring", stiffness: 600, damping: 22 } as Transition,
};

// Liste : entrée échelonnée, courte (le total reste < 400 ms même à 12 éléments).
export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.02 } },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT } },
};
