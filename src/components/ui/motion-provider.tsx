"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// Respecte le réglage système « réduire les animations » pour tout framer-motion.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
