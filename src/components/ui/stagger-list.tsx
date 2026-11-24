"use client";

import { Children, isValidElement, type ReactNode } from "react";
import { motion } from "framer-motion";
import { listContainer, listItem } from "@/lib/motion";

// Entrée échelonnée d'une liste. Rejouée uniquement au montage : les éléments
// ajoutés ensuite (temps réel, pagination) apparaissent sans animation pour ne
// pas faire "sauter" une liste vivante. Au-delà de 12 éléments, le reste
// s'affiche d'un bloc.
const MAX_ANIMATED = 12;

export function StaggerList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const items = Children.toArray(children);
  return (
    <motion.div className={className} variants={listContainer} initial="hidden" animate="show">
      {items.map((child, i) => {
        // Clé stable de l'élément (Children.toArray les préfixe) : l'état local
        // d'une carte ne doit pas migrer vers une autre quand la liste change.
        const key = isValidElement(child) && child.key != null ? child.key : i;
        return i < MAX_ANIMATED ? (
          <motion.div key={key} variants={listItem}>
            {child}
          </motion.div>
        ) : (
          <div key={key}>{child}</div>
        );
      })}
    </motion.div>
  );
}
