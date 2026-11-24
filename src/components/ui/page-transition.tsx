"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { DURATION, EASE_OUT } from "@/lib/motion";

// Fondu d'entrée entre deux pages. Opacité UNIQUEMENT : un transform sur ce
// parent casserait les enfants `position: fixed` (chat plein écran, FAB) et
// `sticky`, qui se rattacheraient à lui au lieu du viewport.
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
